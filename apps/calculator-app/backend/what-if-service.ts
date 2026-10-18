import type { GradeRecord, Semester } from "./gpa-service";

export type WhatIfChanges = Record<string, Partial<GradeRecord>>;

export function applyWhatIf(record: GradeRecord, changes: WhatIfChanges) {
  return { ...record, ...changes[record.id] };
}

export function applyWhatIfToSemesters(semesters: Semester[], changes: WhatIfChanges) {
  return semesters.map((semester) => ({
    ...semester,
    records: semester.records.map((record) => applyWhatIf(record, changes)),
  }));
}
