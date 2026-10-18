// TODO (Define semester and grade record models):
// Temporary shape aligned with the gpa-calc course list (plus units).
// When official models are ready, map them into this shape or share one type.
export type GpaCourse = {
  id?: string;
  courseName: string;
  units: number;
  season: string;
  year: string;
  letterGrade: string;
  percentGrade?: string;
};

export type GpaResult = {
  gpa: number | null; // null => show N/A in the UI
  units: number;
};

// Two hardcoded courses matching the gpa-calc course list seeds (with units).
// Use these to try the engine: empty list, invalid grades, etc.
export const SAMPLE_COURSES: GpaCourse[] = [
  {
    id: "cs-151",
    courseName: "CS 151",
    units: 3,
    season: "Fall",
    year: "2026",
    letterGrade: "B+",
    percentGrade: "89.51",
  },
  {
    id: "cs-160",
    courseName: "CS 160",
    units: 3,
    season: "Fall",
    year: "2026",
    letterGrade: "B+",
    percentGrade: "89.51",
  },
];

// TODO (Implement the SJSU grade mapping):
// Replace this stub with the real map.
// Leave excluded grades (CR, NC, W, I, …) out of the map so they are skipped.
const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

function semesterKey(course: Pick<GpaCourse, "season" | "year">) {
  return `${course.season} ${course.year}`;
}

function calculateFromCourses(courses: GpaCourse[]): GpaResult {
  let qualityPoints = 0;
  let units = 0;

  for (const course of courses) {
    if (!(course.units > 0)) {
      continue;
    }

    const points = GRADE_POINTS[course.letterGrade.trim()];
    if (points === undefined) {
      continue;
    }

    qualityPoints += points * course.units;
    units += course.units;
  }

  return {
    gpa: units === 0 ? null : qualityPoints / units,
    units,
  };
}

// TODO (Implement what-if calculations):
// Call these with a copied course list that has what-if grades.
export function calculateSemesterGpa(
  courses: GpaCourse[],
  semesterId: string,
): GpaResult {
  return calculateFromCourses(
    courses.filter((course) => semesterKey(course) === semesterId),
  );
}

export function calculateCgpa(courses: GpaCourse[]): GpaResult {
  return calculateFromCourses(courses);
}
