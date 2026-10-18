import type { Semester } from "../backend/gpa-service";

const STORAGE_KEY = "four-point-o:gpa-semesters";

export function loadSemesters(): Semester[] | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Semester[]) : null;
  } catch {
    return null;
  }
}

export function saveSemesters(semesters: Semester[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
    return true;
  } catch {
    return false;
  }
}
