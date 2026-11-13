-- GPA course rows are readable with the public anon key unless the database
-- enforces ownership. Policies, a user_id trigger, and unique indexes are the
-- source of truth; server actions are a second check.

create schema if not exists private;

revoke all on schema private from public;

create table if not exists public."gpa-calc-user-courses" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season text not null,
  year text not null,
  source text not null,
  catalog_course_id text,
  course_name text not null,
  units numeric,
  letter_grade text,
  percent_grade text
);

alter table public."gpa-calc-user-courses" enable row level security;
alter table public."gpa-calc-user-courses" force row level security;

revoke all on table public."gpa-calc-user-courses" from public, anon;
grant select, insert, update, delete on table public."gpa-calc-user-courses" to authenticated;

create or replace function private.gpa_calc_force_user_id()
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

revoke all on function private.gpa_calc_force_user_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.gpa_calc_force_user_id() to authenticated;

drop trigger if exists gpa_calc_force_user_id on public."gpa-calc-user-courses";
create trigger gpa_calc_force_user_id
  before insert or update on public."gpa-calc-user-courses"
  for each row
  execute function private.gpa_calc_force_user_id();

drop policy if exists "gpa courses select own" on public."gpa-calc-user-courses";
create policy "gpa courses select own"
  on public."gpa-calc-user-courses"
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "gpa courses insert own" on public."gpa-calc-user-courses";
create policy "gpa courses insert own"
  on public."gpa-calc-user-courses"
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "gpa courses update own" on public."gpa-calc-user-courses";
create policy "gpa courses update own"
  on public."gpa-calc-user-courses"
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "gpa courses delete own" on public."gpa-calc-user-courses";
create policy "gpa courses delete own"
  on public."gpa-calc-user-courses"
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpa_calc_user_courses_source_check'
      and conrelid = 'public."gpa-calc-user-courses"'::regclass
  ) then
    alter table public."gpa-calc-user-courses"
      add constraint gpa_calc_user_courses_source_check
      check (source in ('catalog', 'manual'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpa_calc_user_courses_name_length_check'
      and conrelid = 'public."gpa-calc-user-courses"'::regclass
  ) then
    alter table public."gpa-calc-user-courses"
      add constraint gpa_calc_user_courses_name_length_check
      check (char_length(course_name) between 1 and 120);
  end if;
end $$;

create unique index if not exists gpa_calc_user_courses_catalog_term_uidx
  on public."gpa-calc-user-courses" (user_id, season, year, catalog_course_id)
  where catalog_course_id is not null;

create unique index if not exists gpa_calc_user_courses_manual_term_uidx
  on public."gpa-calc-user-courses" (user_id, season, year, course_name)
  where source = 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpa_calc_user_courses_letter_grade_check'
      and conrelid = 'public."gpa-calc-user-courses"'::regclass
  ) then
    alter table public."gpa-calc-user-courses"
      add constraint gpa_calc_user_courses_letter_grade_check
      check (
        letter_grade is null
        or letter_grade in (
          'A+', 'A', 'A-',
          'B+', 'B', 'B-',
          'C+', 'C', 'C-',
          'D+', 'D', 'D-',
          'F', 'CR', 'NC', 'W', 'WU', 'I'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpa_calc_user_courses_percent_grade_check'
      and conrelid = 'public."gpa-calc-user-courses"'::regclass
  ) then
    alter table public."gpa-calc-user-courses"
      add constraint gpa_calc_user_courses_percent_grade_check
      check (
        percent_grade is null
        or (
          percent_grade ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
          and case
            when percent_grade ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$'
              then percent_grade::numeric <= 100
            else false
          end
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpa_calc_user_courses_units_check'
      and conrelid = 'public."gpa-calc-user-courses"'::regclass
  ) then
    alter table public."gpa-calc-user-courses"
      add constraint gpa_calc_user_courses_units_check
      check (units is null or (units >= 0.5 and units <= 6));
  end if;
end $$;
