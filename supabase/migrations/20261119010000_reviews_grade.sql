-- Optional letter grade on each review so professor and course grade
-- averages can be computed (SJSU 4.0 scale mapping in app code).

alter table public.reviews
  add column grade text,
  add constraint reviews_grade_check check (
    grade is null
    or grade in (
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'B-',
      'C+',
      'C',
      'C-',
      'D+',
      'D',
      'D-',
      'F'
    )
  );

grant update (grade) on table public.reviews to authenticated;
