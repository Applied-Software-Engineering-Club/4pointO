export type DashboardCourse = {
  id: string;
  code: string;
  title: string;
  grade: string;
};
export type DashboardAssignment = {
  id: string;
  title: string;
  course: string;
  dueDate: string | null;
  completed: boolean;
};
export type DashboardEvent = {
  id: string;
  title: string;
  day: number; // Dashboard display: Monday = 0. The real adapter converts calendar days.
  start: number;
  end: number;
  kind: "class" | "study" | "personal";
};
export type DashboardData = {
  name: string | null;
  date: string;
  term: string;
  courses: DashboardCourse[];
  assignments: DashboardAssignment[];
  events: DashboardEvent[];
  semesterGpa: number | null;
  cumulativeGpa: number | null;
  nextClass: { title: string; code: string; professor: string; time: string; location: string; status: string } | null;
  degree: { completed: number; total: number; label: string } | null;
  notice?: string;
};
export function emptyDashboard(date: string): DashboardData {
  const current = new Date(`${date}T12:00:00`);
  return {
    name: null, date, term: `${current.getMonth() < 6 ? "Spring" : "Fall"} ${current.getFullYear()}`,
    courses: [], assignments: [], events: [], semesterGpa: null, cumulativeGpa: null,
    nextClass: null, degree: null,
  };
}
