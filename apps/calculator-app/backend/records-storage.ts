// Browser-storage persistence for GPA calculator grade records.
// Swap the internals here (e.g. for the record CRUD service) without touching the UI.

export type CourseGrade = {
  id: string;
  courseName: string;
  season: string;
  year: string;
  letterGrade: string;
  percentGrade: string;
};

export const STORAGE_KEY = "4pointO.gpa-calc.records";
const STORAGE_VERSION = 1;

type StoredPayload = {
  version: number;
  records: CourseGrade[];
};

export type LoadResult =
  | { ok: true; records: CourseGrade[] | null } // null = nothing saved yet
  | { ok: false; error: string };

export type SaveResult = { ok: true } | { ok: false; error: string };

const stringFields = [
  "id",
  "courseName",
  "season",
  "year",
  "letterGrade",
  "percentGrade",
] as const;

function isCourseGrade(value: unknown): value is CourseGrade {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return stringFields.every((field) => typeof record[field] === "string");
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Access can throw when site data is blocked.
  }
}

export function loadRecords(): LoadResult {
  const storage = getStorage();
  if (!storage) {
    return { ok: false, error: "Browser storage is unavailable." };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, error: "Couldn't read saved grades." };
  }

  if (raw === null) {
    return { ok: true, records: null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (
      parsed?.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.records) ||
      !parsed.records.every(isCourseGrade)
    ) {
      throw new Error("Unexpected format");
    }
    return { ok: true, records: parsed.records };
  } catch {
    // Keep the unreadable data so it can be recovered instead of overwriting it.
    try {
      storage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      // Ignore: nothing more we can do.
    }
    return { ok: false, error: "Saved grades couldn't be read." };
  }
}

export function saveRecords(records: CourseGrade[]): SaveResult {
  const storage = getStorage();
  if (!storage) {
    return { ok: false, error: "Browser storage is unavailable." };
  }

  const payload: StoredPayload = { version: STORAGE_VERSION, records };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.code === 22);
    return {
      ok: false,
      error: quota ? "Browser storage is full." : "Couldn't save grades.",
    };
  }
}
