"use server";

import { createClient } from "@/utils/supabase/server";
import {
  courseProgress,
  userCourseColumns,
  userCourseFromRow,
  type CourseProgress,
  type UserCourse,
} from "./userCourse";

function courseId(id: string) {
  const trimmed = id.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("Couldn't save this course.");
  }

  return trimmed;
}

export async function updateCourseProgress(
  id: string,
  progress: CourseProgress,
): Promise<UserCourse> {
  const courseIdValue = courseId(id);
  const counts = courseProgress(progress);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save this course.");
  }

  const { data, error } = await supabase
    .from("user-courses")
    .update({
      homework_completed: counts.homeworkCompleted,
      homework_total: counts.homeworkTotal,
      exams_completed: counts.examsCompleted,
      exams_total: counts.examsTotal,
      projects_completed: counts.projectsCompleted,
      projects_total: counts.projectsTotal,
    })
    .eq("id", courseIdValue)
    .eq("user_id", auth.user.id)
    .select(userCourseColumns)
    .single();

  const saved = data && typeof data === "object" ? userCourseFromRow(data) : null;
  if (error || !saved) {
    throw new Error("Couldn't save this course.");
  }

  return saved;
}
