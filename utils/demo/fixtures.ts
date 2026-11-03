import type { DisplayUserCourse } from "@/apps/calculator-app/backend/courses/listUserCourses";
import { calculateCgpa } from "@/apps/calculator-app/backend/gpa";
import type { CatalogCourse } from "@/apps/calculator-app/backend/course-service";
import type { DashboardData } from "@/components/dashboard/model";

// Deliberately non-database identifiers. This module is never loaded by real data access.
export const demoGpaCourses: DisplayUserCourse[] = [
  ["CS 146", "A-", "91"], ["CS 147", "A", "95"], ["MATH 129A", "B+", "88"],
  ["STAT 95", "A-", "92"], ["PHIL 134", "A", "94"],
].map(([courseName, letterGrade, percentGrade], index) => ({
  id: `demo-course-${index}`, courseName, letterGrade, percentGrade,
  season: "Fall", year: "2026", credits: "3",
}));
const sampleGpa = calculateCgpa(demoGpaCourses.map((course) => ({ ...course, units: Number(course.credits) }))).gpa;
export const demoDashboard: DashboardData = {
  name: "Maya", date: "2026-10-19", term: "Fall 2026",
  semesterGpa: sampleGpa, cumulativeGpa: sampleGpa,
  courses: demoGpaCourses.map((course, index) => ({
    id: course.id, code: course.courseName,
    title: ["Data structures & algorithms", "Computer architecture", "Linear algebra", "Elementary statistics", "Computers, ethics & society"][index],
    grade: `${course.percentGrade}% · ${course.letterGrade}`,
  })),
  assignments: [
    { id: "demo-task-1", title: "Graph problem set", course: "CS 146", dueDate: "2026-10-19T23:59:00", completed: false },
    { id: "demo-task-2", title: "Probability practice", course: "STAT 95", dueDate: "2026-10-19T17:00:00", completed: false },
    { id: "demo-task-3", title: "Cache simulator", course: "CS 147", dueDate: "2026-10-19T18:00:00", completed: false },
    { id: "demo-task-4", title: "Ethics response", course: "PHIL 134", dueDate: "2026-10-18T09:00:00", completed: true },
  ],
  events: [
    { id: "demo-event-1", title: "Algorithms · MacQuarrie 225", day: 0, start: 600, end: 675, kind: "class" },
    { id: "demo-event-2", title: "Statistics · Duncan 135", day: 0, start: 780, end: 855, kind: "class" },
    { id: "demo-event-3", title: "Graph practice · King Library", day: 0, start: 900, end: 960, kind: "study" },
    { id: "demo-event-4", title: "Climbing with Jules", day: 0, start: 1080, end: 1140, kind: "personal" },
    { id: "demo-event-5", title: "Computer architecture", day: 1, start: 660, end: 735, kind: "class" },
    { id: "demo-event-6", title: "Linear algebra", day: 2, start: 600, end: 675, kind: "class" },
    { id: "demo-event-7", title: "Ethics seminar", day: 3, start: 840, end: 915, kind: "class" },
    { id: "demo-event-8", title: "Weekly review · King Library", day: 4, start: 900, end: 960, kind: "study" },
  ],
  nextClass: {
    title: "Data structures & algorithms", code: "CS 146", professor: "Prof. Elena Rivera",
    time: "10:00–11:15 AM", location: "MacQuarrie 225 · Lecture 15", status: "Up next · Demo schedule",
  },
  degree: { completed: 60, total: 120, label: "B.S. Computer Science" },
};
export async function searchDemoCourses(query: string): Promise<CatalogCourse[]> {
  return demoDashboard.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase())).map((course) => ({
    catalog_course_id: course.id, code: course.code, title: course.title,
    subject: course.code.split(" ")[0], number: course.code.split(" ")[1], units_min: 3, units_max: 3,
    description: "Sample course for the local demo. No catalog connection is used.",
    prerequisites: null, corequisites: null, grading: null, notes: null, section: null, source_url: null,
  }));
}
