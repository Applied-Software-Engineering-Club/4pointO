"use server";

import { createClient } from "@/utils/supabase/server";
import { listReviews } from "./listReviews";
import { normalizeReviewText } from "./review";

const LOAD_ERROR_MESSAGE = "Couldn't load review averages.";

/** SJSU letter grade → 4.0-scale points. Excluded grades (CR, NC, W, I, …) are omitted. */
const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

/** Arithmetic mean rounded to 1 decimal, or null when there are no values. */
export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function numberFieldFromRow(
  row: unknown,
  field: "hours_per_week" | "difficulty",
): number | null {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return null;
  }

  const value = (row as Record<string, unknown>)[field];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function averageReviewField(
  professor: string,
  course: string,
  field: "hours_per_week" | "difficulty",
): Promise<number | null> {
  const professorKey = normalizeReviewText(professor);
  const courseKey = normalizeReviewText(course);
  if (!professorKey || !courseKey) {
    return null;
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(field)
    .eq("professor", professorKey)
    .eq("course", courseKey);

  if (error || !Array.isArray(data)) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  const values = data.flatMap((row) => {
    const value = numberFieldFromRow(row, field);
    return value === null ? [] : [value];
  });

  return average(values);
}

/**
 * Average estimated hours/week for reviews of a professor + course.
 * Returns null when unauthenticated, when inputs are empty, or when there are no values.
 */
export async function getAverageHoursPerWeek(
  professor: string,
  course: string,
): Promise<number | null> {
  return averageReviewField(professor, course, "hours_per_week");
}

/**
 * Average difficulty (1–5) for reviews of a professor + course.
 * Skips reviews with null difficulty. Returns null when unauthenticated,
 * when inputs are empty, or when there are no difficulty values.
 */
export async function getAverageDifficulty(
  professor: string,
  course: string,
): Promise<number | null> {
  return averageReviewField(professor, course, "difficulty");
}

/**
 * Average letter grade for reviews of a professor + course, on the SJSU 4.0 scale.
 * Uses listReviews, maps each letter through GRADE_POINTS, and skips null/unknown grades.
 */
export async function getAverageGrade(
  professor: string,
  course: string,
): Promise<number | null> {
  const reviews = await listReviews(professor, course);
  const points = reviews.flatMap((review) => {
    if (!review.grade) {
      return [];
    }

    const value = GRADE_POINTS[review.grade];
    return value === undefined ? [] : [value];
  });

  return average(points);
}
