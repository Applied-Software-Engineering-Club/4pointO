-- The account id stays on the row. reviews_user_professor_course_uidx still
-- allows one review per account for a professor and course. Students cannot read it.

revoke select (user_id) on table public.reviews from public, anon, authenticated;
