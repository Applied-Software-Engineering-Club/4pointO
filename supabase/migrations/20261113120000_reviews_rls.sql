-- One review per SJSU account for a professor and course. The same account can
-- review that professor's other courses. Community up/down counts come from
-- review_votes. Policies, user_id triggers, and the category trigger are the
-- source of truth.

create schema if not exists private;

revoke all on schema private from public;

create or replace function private.is_sjsu_email(email text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select email is not null
    and split_part(email, '@', 1) <> ''
    and split_part(email, '@', 3) = ''
    and lower(split_part(email, '@', 2)) = 'sjsu.edu';
$$;

create or replace function private.current_user_is_sjsu()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_email text;
begin
  select users.email
  into account_email
  from auth.users
  where users.id = (select auth.uid());

  return coalesce(private.is_sjsu_email(account_email), false);
end;
$$;

revoke all on function private.is_sjsu_email(text) from public, anon;
revoke all on function private.current_user_is_sjsu() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_sjsu_email(text) to authenticated;
grant execute on function private.current_user_is_sjsu() to authenticated;

create table if not exists public.review_categories (
  name text primary key
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  professor text not null,
  course text not null,
  up_count integer not null default 0,
  down_count integer not null default 0,
  would_take_again boolean not null,
  message text not null,
  tags text[] not null default '{}',
  hours_per_week integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_professor_check check (char_length(professor) between 1 and 120),
  constraint reviews_course_check check (char_length(course) between 1 and 120),
  constraint reviews_counts_check check (up_count >= 0 and down_count >= 0),
  constraint reviews_message_length_check check (char_length(message) between 1 and 500),
  constraint reviews_hours_per_week_check check (hours_per_week between 0 and 40)
);

create table if not exists public.review_votes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (review_id, user_id),
  constraint review_votes_direction_check check (direction in ('up', 'down'))
);

create unique index if not exists reviews_user_professor_course_uidx
  on public.reviews (user_id, lower(professor), lower(course));

create index if not exists reviews_professor_course_idx
  on public.reviews (professor, course);

alter table public.review_categories enable row level security;
alter table public.review_categories force row level security;
alter table public.reviews enable row level security;
alter table public.reviews force row level security;
alter table public.review_votes enable row level security;
alter table public.review_votes force row level security;

revoke all on table public.review_categories from public, anon;
revoke all on table public.reviews from public, anon;
revoke all on table public.review_votes from public, anon;

grant select on table public.review_categories to authenticated;
grant select, insert, delete on table public.reviews to authenticated;
grant update (professor, course, would_take_again, message, tags, hours_per_week)
  on table public.reviews to authenticated;
grant select, insert, update, delete on table public.review_votes to authenticated;

create or replace function private.reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tag text;
  cleaned text[] := '{}';
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.up_count := 0;
    new.down_count := 0;
    new.created_at := now();
    new.updated_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if current_setting('private.allow_review_counts', true) is distinct from '1' then
      new.up_count := old.up_count;
      new.down_count := old.down_count;
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;

  new.professor := btrim(new.professor);
  new.course := btrim(new.course);
  if new.professor is null or new.professor = '' or new.course is null or new.course = '' then
    raise exception 'professor and course are required';
  end if;

  -- Vote recounts set this flag, including when a vote row is removed by account deletion.
  if current_setting('private.allow_review_counts', true) is distinct from '1'
    and not private.current_user_is_sjsu() then
    raise exception 'SJSU email required';
  end if;

  if new.tags is null then
    new.tags := '{}';
  end if;

  foreach tag in array new.tags loop
    tag := btrim(tag);
    if tag is null or tag = '' then
      continue;
    end if;
    if tag = any (cleaned) then
      raise exception 'duplicate tag: %', tag;
    end if;
    if not exists (
      select 1
      from public.review_categories
      where review_categories.name = tag
    ) then
      raise exception 'unknown review tag: %', tag;
    end if;
    cleaned := array_append(cleaned, tag);
  end loop;

  if coalesce(cardinality(cleaned), 0) > 8 then
    raise exception 'at most 8 review tags';
  end if;

  new.tags := cleaned;
  return new;
end;
$$;

create or replace function private.reviews_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Remember this review so cascade-deleted votes do not recount a row that is going away.
  -- Other reviews this account voted on are not in the list and still get recounted.
  perform set_config(
    'private.deleting_review_ids',
    coalesce(current_setting('private.deleting_review_ids', true), '') || old.id::text || ',',
    true
  );
  return old;
end;
$$;

create or replace function private.review_votes_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if not coalesce(private.current_user_is_sjsu(), false) then
    raise exception 'SJSU email required';
  end if;

  if exists (
    select 1
    from public.reviews
    where reviews.id = new.review_id
      and reviews.user_id = new.user_id
  ) then
    raise exception 'cannot vote on your own review';
  end if;

  return new;
end;
$$;

create or replace function private.review_votes_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    target := old.review_id;
  else
    target := new.review_id;
  end if;

  if position(
    target::text in coalesce(current_setting('private.deleting_review_ids', true), '')
  ) > 0 then
    return null;
  end if;

  perform set_config('private.allow_review_counts', '1', true);

  update public.reviews
  set
    up_count = (
      select count(*)::integer
      from public.review_votes
      where review_votes.review_id = target
        and review_votes.direction = 'up'
    ),
    down_count = (
      select count(*)::integer
      from public.review_votes
      where review_votes.review_id = target
        and review_votes.direction = 'down'
    )
  where reviews.id = target;

  if tg_op = 'UPDATE' and old.review_id is distinct from new.review_id then
    update public.reviews
    set
      up_count = (
        select count(*)::integer
        from public.review_votes
        where review_votes.review_id = old.review_id
          and review_votes.direction = 'up'
      ),
      down_count = (
        select count(*)::integer
        from public.review_votes
        where review_votes.review_id = old.review_id
          and review_votes.direction = 'down'
      )
    where reviews.id = old.review_id;
  end if;

  perform set_config('private.allow_review_counts', '0', true);
  return null;
end;
$$;

revoke all on function private.reviews_before_write() from public, anon;
revoke all on function private.reviews_before_delete() from public, anon;
revoke all on function private.review_votes_before_write() from public, anon;
revoke all on function private.review_votes_after_write() from public, anon;
grant execute on function private.reviews_before_write() to authenticated;
grant execute on function private.reviews_before_delete() to authenticated;
grant execute on function private.review_votes_before_write() to authenticated;
grant execute on function private.review_votes_after_write() to authenticated;

create trigger reviews_before_write
  before insert or update on public.reviews
  for each row
  execute function private.reviews_before_write();

create trigger reviews_before_delete
  before delete on public.reviews
  for each row
  execute function private.reviews_before_delete();

create trigger review_votes_before_write
  before insert or update on public.review_votes
  for each row
  execute function private.review_votes_before_write();

create trigger review_votes_after_write
  after insert or update or delete on public.review_votes
  for each row
  execute function private.review_votes_after_write();

create policy "review categories select"
  on public.review_categories
  for select
  to authenticated
  using ((select private.current_user_is_sjsu()));

create policy "reviews select"
  on public.reviews
  for select
  to authenticated
  using ((select private.current_user_is_sjsu()));

create policy "reviews insert own"
  on public.reviews
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  );

create policy "reviews update own"
  on public.reviews
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  )
  with check (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  );

create policy "reviews delete own"
  on public.reviews
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  );

create policy "review votes select own"
  on public.review_votes
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  );

create policy "review votes insert own"
  on public.review_votes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
    and not exists (
      select 1
      from public.reviews
      where reviews.id = review_id
        and reviews.user_id = (select auth.uid())
    )
  );

create policy "review votes update own"
  on public.review_votes
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  )
  with check (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
    and not exists (
      select 1
      from public.reviews
      where reviews.id = review_id
        and reviews.user_id = (select auth.uid())
    )
  );

create policy "review votes delete own"
  on public.review_votes
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_user_is_sjsu())
  );

insert into public.review_categories (name)
values
  ('Clear lectures'),
  ('Gives good feedback'),
  ('Test heavy'),
  ('Quiz heavy'),
  ('Project based'),
  ('Group projects'),
  ('Presentations'),
  ('Reading heavy'),
  ('Attendance required'),
  ('Extra credit'),
  ('Cheatsheets allowed')
on conflict (name) do nothing;
