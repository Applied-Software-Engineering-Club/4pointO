const MAX_SEARCH_RESULTS = 10;

export const CATALOG_COURSE_COLUMNS =
  "catalog_course_id, code, subject, number, title, units_min, units_max, description, prerequisites, corequisites, grading, notes, section, source_url";

export type CatalogCourse = {
  catalog_course_id: string;
  code: string;
  subject: string;
  number: string;
  title: string;
  units_min: number;
  units_max: number;
  description: string | null;
  prerequisites: string | null;
  corequisites: string | null;
  grading: string | null;
  notes: string | null;
  section: string | null;
  source_url: string | null;
};

type SupabaseCourseRow = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text || null;
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Convert a row from Supabase into the shape used by the course dialog. */
export function parseCourse(row: SupabaseCourseRow): CatalogCourse | null {
  const code = asString(row.code).trim();
  const title = asString(row.title).trim();
  if (!code || !title) return null;

  const unitsMin = asNumber(row.units_min);
  const unitsMax = asNumber(row.units_max ?? row.units_min);
  return {
    catalog_course_id: asString(row.catalog_course_id || row.id || row.course_id || code),
    code,
    subject: asString(row.subject).trim(),
    number: asString(row.number).trim(),
    title,
    units_min: unitsMin,
    units_max: unitsMax || unitsMin,
    description: asNullableString(row.description),
    prerequisites: asNullableString(row.prerequisites),
    corequisites: asNullableString(row.corequisites),
    grading: asNullableString(row.grading),
    notes: asNullableString(row.notes),
    section: asNullableString(row.section),
    source_url: asNullableString(row.source_url),
  };
}

export function catalogCourses(rows: unknown): CatalogCourse[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is SupabaseCourseRow => typeof row === "object" && row !== null)
    .map(parseCourse)
    .filter((course): course is CatalogCourse => course !== null)
    .slice(0, MAX_SEARCH_RESULTS);
}

export { MAX_SEARCH_RESULTS };
