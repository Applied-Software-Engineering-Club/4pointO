export const SEASONS = ["Fall", "Winter", "Spring", "Summer"] as const;

export const MAX_COURSE_NAME_LENGTH = 120;
export const MAX_CATALOG_COURSE_ID_LENGTH = 64;
export const MAX_COURSE_BATCH = 60;

export const GPA_USER_COURSE_COLUMNS =
  "id, course_name, season, year, letter_grade, percent_grade, units";

export type Season = (typeof SEASONS)[number];

export type CourseSelection = {
  source: "catalog" | "manual";
  catalogCourseId: string | null;
  courseName: string;
  units?: number;
};

export type SavedUserCourse = {
  id: string;
  units: string;
};
