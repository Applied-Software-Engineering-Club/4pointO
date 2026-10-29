"use server";

import { createClient } from "@/utils/supabase/server";
import { userCourseFromRow, type UserCourse } from "./userCourse";

const columns = [
  "id",
  "course_number",
  "course_name",
  "course_days",
  "course_start",
  "course_end",
  "office_hours_days",
  "office_hours_start",
  "office_hours_end",
  "professor_name",
  "professor_email",
  "prerequisites",
  "homework_completed",
  "homework_total",
  "exams_completed",
  "exams_total",
  "projects_completed",
  "projects_total",
].join(", ");

export async function listUserCourses(): Promise<UserCourse[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user-courses")
    .select(columns)
    .eq("user_id", auth.user.id)
    .order("created_at");

  if (error || !Array.isArray(data)) {
    throw new Error("Couldn't load your courses.");
  }

  return data.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const course = userCourseFromRow(row as Record<string, unknown>);
    return course ? [course] : [];
  });
}
