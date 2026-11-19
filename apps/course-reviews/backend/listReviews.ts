"use server";

import { createClient } from "@/utils/supabase/server";
import { reviewColumns, reviewFromRow, normalizeReviewText, type CourseReview } from "./review";

export async function listReviews(professor: string, course: string): Promise<CourseReview[]> {
  const professorName = normalizeReviewText(professor);
  const courseName = normalizeReviewText(course);
  if (!professorName || !courseName) {
    return [];
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(reviewColumns)
    .eq("professor", professorName)
    .eq("course", courseName)
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    throw new Error("Could not load reviews.");
  }

  return data.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const review = reviewFromRow(row as Record<string, unknown>);
    return review ? [review] : [];
  });
}
