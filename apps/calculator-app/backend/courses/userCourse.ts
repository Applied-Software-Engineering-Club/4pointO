export const SEASONS = ["Fall", "Winter", "Spring", "Summer"] as const;

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
