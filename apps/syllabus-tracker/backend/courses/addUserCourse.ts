"use server";

import { createClient } from "@/utils/supabase/server";
import {
  userCourseColumns,
  userCourseDraft,
  userCourseFromRow,
  type UserCourse,
  type UserCourseDraft,
} from "./userCourse";

function emptyToNull(value: string) {
  return value || null;
}

export async function addUserCourse(input: UserCourseDraft): Promise<UserCourse> {
  const course = userCourseDraft(input);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save this course.");
  }

  const { data, error } = await supabase
    .from("user-courses")
    .insert({
      user_id: auth.user.id,
      course_number: course.courseNumber,
      course_name: course.courseName,
      course_days: emptyToNull(course.courseDays),
      course_start: emptyToNull(course.courseStart),
      course_end: emptyToNull(course.courseEnd),
      office_hours_days: emptyToNull(course.officeHoursDays),
      office_hours_start: emptyToNull(course.officeHoursStart),
      office_hours_end: emptyToNull(course.officeHoursEnd),
      professor_name: emptyToNull(course.professorName),
      professor_email: emptyToNull(course.professorEmail),
      prerequisites: emptyToNull(course.prerequisites),
      homework_completed: course.homeworkCompleted,
      homework_total: course.homeworkTotal,
      exams_completed: course.examsCompleted,
      exams_total: course.examsTotal,
      projects_completed: course.projectsCompleted,
      projects_total: course.projectsTotal,
    })
    .select(userCourseColumns)
    .single();

  const saved = data && typeof data === "object" ? userCourseFromRow(data) : null;
  if (error || !saved) {
    throw new Error("Couldn't save this course.");
  }

  return saved;
}
