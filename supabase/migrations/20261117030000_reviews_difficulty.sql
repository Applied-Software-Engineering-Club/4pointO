-- Optional 1–5 difficulty on each review so professor and course averages can be computed later.

alter table public.reviews
  add column difficulty integer,
  add constraint reviews_difficulty_check check (difficulty between 1 and 5);

grant update (difficulty) on table public.reviews to authenticated;
