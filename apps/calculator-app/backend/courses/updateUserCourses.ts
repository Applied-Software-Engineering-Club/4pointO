"use server";

import { createClient } from "@/utils/supabase/server";
import type { DisplayUserCourse } from "./listUserCourses";
import { MAX_COURSE_BATCH, MAX_COURSE_NAME_LENGTH, SEASONS, type Season } from "./userCourse";

const LETTER_GRADES = new Set([
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
  "CR",
  "NC",
  "W",
  "WU",
  "I",
]);

type CourseUpdate = {
  id: string;
  courseName: string;
  season: Season;
  year: string;
  letterGrade: string;
  percentGrade: string;
  units: number | null;
};

function isSeason(value: string): value is Season {
  return (SEASONS as readonly string[]).includes(value);
}

function unitsValue(credits: string) {
  if (credits.trim() === "") {
    return null;
  }

  const parsed = Number(credits);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 6) {
    throw new Error("Couldn't save these changes.");
  }

  return parsed;
}

function percentValue(value: string) {
  if (value === "") {
    return "";
  }

  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value) || Number(value) > 100) {
    throw new Error("Couldn't save these changes.");
  }

  return value;
}

function courseUpdate(course: DisplayUserCourse): CourseUpdate {
  const id = course.id.trim();
  const courseName = course.courseName.trim();
  const season = course.season.trim();
  const year = course.year.trim();
  const letterGrade = course.letterGrade.trim();

  if (
    !id ||
    !courseName ||
    courseName.length > MAX_COURSE_NAME_LENGTH ||
    !isSeason(season) ||
    !/^\d{4}$/.test(year)
  ) {
    throw new Error("Couldn't save these changes.");
  }

  if (letterGrade && !LETTER_GRADES.has(letterGrade)) {
    throw new Error("Couldn't save these changes.");
  }

  return {
    id,
    courseName,
    season,
    year,
    letterGrade,
    percentGrade: percentValue(course.percentGrade.trim()),
    units: unitsValue(course.credits),
  };
}

function displayCourse(course: CourseUpdate): DisplayUserCourse {
  return {
    id: course.id,
    courseName: course.courseName,
    season: course.season,
    year: course.year,
    letterGrade: course.letterGrade,
    percentGrade: course.percentGrade,
    credits: course.units == null ? "" : String(course.units),
  };
}

export async function updateUserCourses(
  courses: DisplayUserCourse[],
): Promise<DisplayUserCourse[]> {
  if (!Array.isArray(courses) || courses.length > MAX_COURSE_BATCH) {
    throw new Error("Couldn't save these changes.");
  }

  const updates = courses.map(courseUpdate);
  const ids = updates.map((course) => course.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Couldn't save these changes.");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save these changes.");
  }

  const user = auth.user;

  if (ids.length > 0) {
    const existing = await supabase
      .from("gpa-calc-user-courses")
      .select("id")
      .eq("user_id", user.id)
      .in("id", ids);

    if (existing.error || existing.data?.length !== ids.length) {
      throw new Error("Couldn't save these changes.");
    }
  }

  const saved: DisplayUserCourse[] = [];

  for (const course of updates) {
    const { data, error } = await supabase
      .from("gpa-calc-user-courses")
      .update({
        season: course.season,
        year: course.year,
        units: course.units,
        letter_grade: course.letterGrade || null,
        percent_grade: course.percentGrade || null,
      })
      .eq("id", course.id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Couldn't save these changes.");
    }

    saved.push(displayCourse(course));
  }

  return saved;
}
