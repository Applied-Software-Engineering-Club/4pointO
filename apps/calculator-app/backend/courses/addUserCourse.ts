"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import {
  SEASONS,
  type CourseSelection,
  type SavedUserCourse,
  type Season,
} from "./userCourse";

type NewUserCourse = CourseSelection & {
  season: Season;
  year: string;
};

async function courseAlreadySaved(
  supabase: SupabaseClient,
  userId: string,
  course: NewUserCourse & { courseName: string },
) {
  let query = supabase
    .from("gpa-calc-user-courses")
    .select("id")
    .eq("user_id", userId)
    .eq("season", course.season)
    .eq("year", course.year)
    .limit(1);

  query =
    course.source === "catalog"
      ? query.eq("catalog_course_id", course.catalogCourseId)
      : query.eq("course_name", course.courseName);

  const { data, error } = await query;
  if (error) {
    throw new Error("Couldn't save this course.");
  }

  return (data?.length ?? 0) > 0;
}

function savedUnits(value: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Couldn't save this course.");
  }

  return String(parsed);
}

export type AddUserCourseResult =
  | { duplicate: true }
  | { duplicate: false; course: SavedUserCourse };

export async function addUserCourse(
  course: NewUserCourse,
): Promise<AddUserCourseResult> {
  const courseName = course.courseName.trim();
  if (!courseName || !SEASONS.includes(course.season) || !/^\d{4}$/.test(course.year)) {
    throw new Error("Couldn't save this course.");
  }

  if (course.source === "catalog" && !course.catalogCourseId) {
    throw new Error("Couldn't save this course.");
  }

  if (
    course.units !== undefined &&
    !(course.units >= 0.5 && course.units <= 6)
  ) {
    throw new Error("Couldn't save this course.");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save this course.");
  }

  if (
    await courseAlreadySaved(supabase, auth.user.id, {
      ...course,
      courseName,
    })
  ) {
    return { duplicate: true as const };
  }

  const { data, error } = await supabase
    .from("gpa-calc-user-courses")
    .insert({
      user_id: auth.user.id,
      season: course.season,
      year: course.year,
      source: course.source,
      catalog_course_id:
        course.source === "catalog" ? course.catalogCourseId : null,
      course_name: courseName,
      ...(course.units !== undefined ? { units: course.units } : {}),
    })
    .select("id, units")
    .single();

  if (error || !data) {
    throw new Error("Couldn't save this course.");
  }

  return {
    duplicate: false,
    course: {
      id: data.id,
      units: savedUnits(data.units),
    },
  };
}
