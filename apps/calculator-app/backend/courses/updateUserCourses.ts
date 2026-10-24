"use server";

import { createClient } from "@/utils/supabase/server";
import type { DisplayUserCourse } from "./listUserCourses";
import { SEASONS, type Season } from "./userCourse";

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

  if (!id || !courseName || !isSeason(season) || !/^\d{4}$/.test(year)) {
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

function displayCourse(course: CourseUpdate, id = course.id): DisplayUserCourse {
  return {
    id,
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
  const updates = courses.map(courseUpdate);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save these changes.");
  }

  const saved: DisplayUserCourse[] = [];

  for (const course of updates) {
    const changes = {
      season: course.season,
      year: course.year,
      units: course.units,
      letter_grade: course.letterGrade || null,
      percent_grade: course.percentGrade || null,
    };

    const existing = await supabase
      .from("gpa-calc-user-courses")
      .select("id")
      .eq("id", course.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (existing.error) {
      throw new Error("Couldn't save these changes.");
    }

    if (existing.data) {
      const { data, error } = await supabase
        .from("gpa-calc-user-courses")
        .update(changes)
        .eq("id", course.id)
        .eq("user_id", auth.user.id)
        .select("id")
        .single();

      if (error || !data) {
        throw new Error("Couldn't save these changes.");
      }

      saved.push(displayCourse(course));
      continue;
    }

    const { data, error } = await supabase
      .from("gpa-calc-user-courses")
      .insert({
        user_id: auth.user.id,
        source: "manual",
        catalog_course_id: null,
        course_name: course.courseName,
        ...changes,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Couldn't save these changes.");
    }

    saved.push(displayCourse(course, data.id));
  }

  return saved;
}
