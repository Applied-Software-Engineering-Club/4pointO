export const LETTER_GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
  "CR", "NC", "W", "WU", "I",
] as const;

export type LetterGrade = (typeof LETTER_GRADES)[number];

// SJSU quality points. CR/NC, W, and I do not contribute units; WU is an F.
export const GRADE_POINTS: Record<LetterGrade, number | null> = {
  "A+": 4, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7,
  "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7,
  F: 0, CR: null, NC: null, W: null, WU: 0, I: null,
};

export type GradeRecord = {
  id: string;
  courseId: string;
  courseName: string;
  units: number;
  season: string;
  year: string;
  letterGrade: string;
  percentGrade: string;
};

export type Semester = { id: string; season: string; year: string; records: GradeRecord[] };

export type GpaResult = { gpa: number | null; qualityPoints: number; includedUnits: number };

export function isSupportedGrade(grade: string): grade is LetterGrade {
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade);
}

export function calculateGpa(records: GradeRecord[]): GpaResult {
  return records.reduce(
    (result, record) => {
      const points = isSupportedGrade(record.letterGrade) ? GRADE_POINTS[record.letterGrade] : undefined;
      if (points === undefined || points === null || !Number.isFinite(record.units) || record.units <= 0) {
        return result;
      }
      result.qualityPoints += points * record.units;
      result.includedUnits += record.units;
      return result;
    },
    { gpa: null, qualityPoints: 0, includedUnits: 0 },
  );
}

export function finalizeGpa(result: GpaResult): GpaResult {
  return { ...result, gpa: result.includedUnits ? result.qualityPoints / result.includedUnits : null };
}

export function calculateSemesterGpa(records: GradeRecord[]) {
  return finalizeGpa(calculateGpa(records));
}

export function calculateCgpa(semesters: Semester[]) {
  return finalizeGpa(calculateGpa(semesters.flatMap((semester) => semester.records)));
}

export function validateRecord(record: Pick<GradeRecord, "courseName" | "units" | "letterGrade">) {
  if (!record.courseName.trim()) return "Enter a course name.";
  if (!Number.isFinite(record.units) || record.units < 0.5 || record.units > 6) return "Units must be between 0.5 and 6.";
  if (!isSupportedGrade(record.letterGrade)) return "Choose a supported letter grade.";
  return null;
}
