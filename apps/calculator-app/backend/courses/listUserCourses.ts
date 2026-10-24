"use server";

import { createClient } from "@/utils/supabase/server";

export type DisplayUserCourse = {
  id: string;
  courseName: string;
  season: string;
  year: string;
  letterGrade: string;
  percentGrade: string;
  credits: string;
};

function text(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function credits(value: unknown) {
  if (value == null || value === "") {
    return "";
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(parsed);
}

function toDisplayUserCourse(row: Record<string, unknown>): DisplayUserCourse | null {
  const id = text(row.id);
  const courseName = text(row.course_name);
  if (!id || !courseName) {
    return null;
  }

  return {
    id,
    courseName,
    season: text(row.season),
    year: text(row.year),
    letterGrade: text(row.letter_grade),
    percentGrade: text(row.percent_grade),
    credits: credits(row.units),
  };
}

export async function listUserCourses(): Promise<DisplayUserCourse[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("gpa-calc-user-courses")
    .select("*")
    .eq("user_id", auth.user.id);

  if (error || !Array.isArray(data)) {
    throw new Error("Couldn't load courses.");
  }

  return data.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const course = toDisplayUserCourse(row as Record<string, unknown>);
    return course ? [course] : [];
  });
}
