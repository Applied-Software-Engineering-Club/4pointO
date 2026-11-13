"use server";

import { createClient } from "@supabase/supabase-js";
import {
  CATALOG_COURSE_COLUMNS,
  catalogCourses,
  MAX_SEARCH_RESULTS,
  parseCourse,
  type CatalogCourse,
} from "@/apps/calculator-app/backend/course-service";
import { getSupabaseEnv } from "@/utils/supabase/env";

const MAX_QUERY_LENGTH = 80;
const SEARCH_ERROR = "Couldn't search courses.";

function normalizeCourseQuery(query: string) {
  return query
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .replace(/ +/g, " ")
    .slice(0, MAX_QUERY_LENGTH);
}

function quotedIlike(column: string, term: string) {
  return `${column}.ilike."%${term}%"`;
}

function catalogClient() {
  const env = getSupabaseEnv();
  if (!env) {
    return null;
  }

  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function searchCourses(query: string): Promise<CatalogCourse[]> {
  const term = normalizeCourseQuery(query);
  if (!term) {
    return [];
  }

  const supabase = catalogClient();
  if (!supabase) {
    throw new Error(SEARCH_ERROR);
  }

  const { data, error } = await supabase
    .from("courses")
    .select(CATALOG_COURSE_COLUMNS)
    .or(
      [
        quotedIlike("code", term),
        quotedIlike("title", term),
        quotedIlike("subject", term),
        quotedIlike("number", term),
        quotedIlike("section", term),
      ].join(","),
    )
    .limit(MAX_SEARCH_RESULTS);

  if (error) {
    throw new Error(SEARCH_ERROR);
  }

  return catalogCourses(data);
}

export async function getCourseDetails(id: string): Promise<CatalogCourse | undefined> {
  const courseId = id.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(courseId)) {
    return undefined;
  }

  const supabase = catalogClient();
  if (!supabase) {
    throw new Error(SEARCH_ERROR);
  }

  const { data, error } = await supabase
    .from("courses")
    .select(CATALOG_COURSE_COLUMNS)
    .eq("catalog_course_id", courseId)
    .limit(1);

  if (error) {
    throw new Error(SEARCH_ERROR);
  }

  const row = Array.isArray(data) ? data[0] : undefined;
  return row ? parseCourse(row) ?? undefined : undefined;
}
