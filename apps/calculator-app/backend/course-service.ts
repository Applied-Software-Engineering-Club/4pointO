const MAX_SEARCH_RESULTS = 10;

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

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.");
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function searchCourses(query: string): Promise<CatalogCourse[]> {
  const { url, anonKey } = getSupabaseConfig();
  const normalized = query.trim().replace(/[,*()]/g, " ");
  const endpoint = new URL(`${url}/rest/v1/courses`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", String(MAX_SEARCH_RESULTS));
  if (normalized) {
    const pattern = `*${normalized}*`;
    endpoint.searchParams.set("or", `(code.ilike.${pattern},title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern},section.ilike.${pattern})`);
  }

  const response = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) throw new Error(`Supabase course search failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase returned an invalid courses response.");

  return rows
    .filter((row): row is SupabaseCourseRow => typeof row === "object" && row !== null)
    .map(parseCourse)
    .filter((course): course is CatalogCourse => course !== null)
    .slice(0, MAX_SEARCH_RESULTS);
}

export async function getCourseDetails(id: string): Promise<CatalogCourse | undefined> {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = new URL(`${url}/rest/v1/courses`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("catalog_course_id", `eq.${id}`);
  endpoint.searchParams.set("limit", "1");
  const response = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
  if (!response.ok) throw new Error(`Supabase course lookup failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase returned an invalid course response.");
  const row = rows.find((candidate) => typeof candidate === "object" && candidate !== null);
  return row ? parseCourse(row as SupabaseCourseRow) ?? undefined : undefined;
}
