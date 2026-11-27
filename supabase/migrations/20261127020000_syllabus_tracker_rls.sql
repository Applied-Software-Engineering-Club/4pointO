-- Syllabus courses, assignments, and schedule events are readable with the
-- public anon key unless the database enforces ownership. Policies and a
-- user_id trigger are the source of truth; server actions are a second check.

create schema if not exists private;

revoke all on schema private from public;

create table if not exists public."user-courses" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_number text not null,
  course_name text not null,
  course_days text,
  course_start text,
  course_end text,
  office_hours_days text,
  office_hours_start text,
  office_hours_end text,
  professor_name text,
  professor_email text,
  prerequisites text,
  homework_completed integer not null default 0,
  homework_total integer not null default 0,
  exams_completed integer not null default 0,
  exams_total integer not null default 0,
  projects_completed integer not null default 0,
  projects_total integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public."syllabus-todo-items" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  course_id uuid references public."user-courses" (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public."syllabus-schedule-events" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  day integer not null,
  start_minute integer not null,
  end_minute integer not null,
  color text not null,
  created_at timestamptz not null default now()
);

alter table public."user-courses" enable row level security;
alter table public."user-courses" force row level security;
alter table public."syllabus-todo-items" enable row level security;
alter table public."syllabus-todo-items" force row level security;
alter table public."syllabus-schedule-events" enable row level security;
alter table public."syllabus-schedule-events" force row level security;

revoke all on table public."user-courses" from public, anon;
revoke all on table public."syllabus-todo-items" from public, anon;
revoke all on table public."syllabus-schedule-events" from public, anon;

grant select, insert, update, delete on table public."user-courses" to authenticated;
grant select, insert, update, delete on table public."syllabus-todo-items" to authenticated;
grant select, insert, update, delete on table public."syllabus-schedule-events" to authenticated;

create or replace function private.syllabus_force_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  else
    new.user_id := old.user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.syllabus_force_user_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.syllabus_force_user_id() to authenticated;

drop trigger if exists syllabus_force_user_id on public."user-courses";
create trigger syllabus_force_user_id
  before insert or update on public."user-courses"
  for each row
  execute function private.syllabus_force_user_id();

drop trigger if exists syllabus_force_user_id on public."syllabus-todo-items";
create trigger syllabus_force_user_id
  before insert or update on public."syllabus-todo-items"
  for each row
  execute function private.syllabus_force_user_id();

drop trigger if exists syllabus_force_user_id on public."syllabus-schedule-events";
create trigger syllabus_force_user_id
  before insert or update on public."syllabus-schedule-events"
  for each row
  execute function private.syllabus_force_user_id();

drop policy if exists "syllabus courses select own" on public."user-courses";
create policy "syllabus courses select own"
  on public."user-courses"
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "syllabus courses insert own" on public."user-courses";
create policy "syllabus courses insert own"
  on public."user-courses"
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "syllabus courses update own" on public."user-courses";
create policy "syllabus courses update own"
  on public."user-courses"
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "syllabus courses delete own" on public."user-courses";
create policy "syllabus courses delete own"
  on public."user-courses"
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "syllabus todos select own" on public."syllabus-todo-items";
create policy "syllabus todos select own"
  on public."syllabus-todo-items"
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "syllabus todos insert own" on public."syllabus-todo-items";
create policy "syllabus todos insert own"
  on public."syllabus-todo-items"
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      course_id is null
      or exists (
        select 1
        from public."user-courses"
        where "user-courses".id = course_id
          and "user-courses".user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "syllabus todos update own" on public."syllabus-todo-items";
create policy "syllabus todos update own"
  on public."syllabus-todo-items"
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      course_id is null
      or exists (
        select 1
        from public."user-courses"
        where "user-courses".id = course_id
          and "user-courses".user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "syllabus todos delete own" on public."syllabus-todo-items";
create policy "syllabus todos delete own"
  on public."syllabus-todo-items"
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "syllabus schedule select own" on public."syllabus-schedule-events";
create policy "syllabus schedule select own"
  on public."syllabus-schedule-events"
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "syllabus schedule insert own" on public."syllabus-schedule-events";
create policy "syllabus schedule insert own"
  on public."syllabus-schedule-events"
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "syllabus schedule update own" on public."syllabus-schedule-events";
create policy "syllabus schedule update own"
  on public."syllabus-schedule-events"
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "syllabus schedule delete own" on public."syllabus-schedule-events";
create policy "syllabus schedule delete own"
  on public."syllabus-schedule-events"
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create index if not exists user_courses_user_id_idx
  on public."user-courses" (user_id);

create index if not exists syllabus_todo_items_user_id_idx
  on public."syllabus-todo-items" (user_id, due_date);

create index if not exists syllabus_schedule_events_user_id_idx
  on public."syllabus-schedule-events" (user_id, day, start_minute);
