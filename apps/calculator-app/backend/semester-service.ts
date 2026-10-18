import type { Semester } from "./gpa-service";

export function createSemester(season: string, year: string): Semester {
  return { id: crypto.randomUUID(), season, year, records: [] };
}

export function removeSemester(semesters: Semester[], id: string) {
  if (semesters.length <= 1) return { semesters, activeId: id };
  const removedIndex = semesters.findIndex((semester) => semester.id === id);
  const next = semesters.filter((semester) => semester.id !== id);
  const nextActive = next[Math.min(Math.max(removedIndex - 1, 0), next.length - 1)];
  return { semesters: next, activeId: nextActive.id };
}
