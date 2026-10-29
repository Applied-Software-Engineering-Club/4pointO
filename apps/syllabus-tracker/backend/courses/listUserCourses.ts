"use server";

import { createClient } from "@/utils/supabase/server";
import { userCourseColumns, userCourseFromRow, type UserCourse } from "./userCourse";

export async function listUserCourses(): Promise<UserCourse[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user-courses")
    .select(userCourseColumns)
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
