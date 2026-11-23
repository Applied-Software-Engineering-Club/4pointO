"use server";

import { createClient } from "@/utils/supabase/server";
import { reviewColumns, reviewFromRow, validateReviewDraft, type CourseReview, type ReviewDraft } from "./review";

function isSjsuEmail(email: string | undefined) {
  return Boolean(email && /^[^@\s]+@sjsu\.edu$/i.test(email));
}

export async function addReview(input: ReviewDraft): Promise<CourseReview> {
  const review = validateReviewDraft(input);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !isSjsuEmail(auth.user.email)) {
    throw new Error("An authenticated SJSU email is required to submit a review.");
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      professor: review.professor,
      course: review.course,
      would_take_again: review.wouldTakeAgain,
      message: review.message,
      tags: review.tags,
      hours_per_week: review.hoursPerWeek,
      difficulty: review.difficulty,
      grade: review.grade,
    })
    .select(reviewColumns)
    .single();

  if (error?.code === "23505") {
    throw new Error("You already reviewed this professor and course.");
  }

  const saved = data && typeof data === "object" ? reviewFromRow(data) : null;
  if (error || !saved) {
    throw new Error("Could not save your review.");
  }

  return saved;
}
