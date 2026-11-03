import "server-only";
import { getAuthUser } from "@/utils/supabase/server";
import { listUserCourses as listGpaCourses } from "@/apps/calculator-app/backend/courses/listUserCourses";
import { calculateCgpa, calculateSemesterGpa } from "@/apps/calculator-app/backend/gpa";
import { listUserCourses } from "@/apps/syllabus-tracker/backend/courses/listUserCourses";
import { listTodoItems } from "@/apps/syllabus-tracker/backend/todo/listTodoItems";
import { listScheduleEvents } from "@/apps/syllabus-tracker/backend/schedule/listScheduleEvents";
import { emptyDashboard, type DashboardData } from "./model";

const weekdayNumbers: Record<string, number> = {
  mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2,
  thu: 3, thurs: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
};
function courseDays(value: string) {
  const compact: Record<string, number[]> = { mwf: [0, 2, 4], mw: [0, 2], tth: [1, 3], tr: [1, 3] };
  if (compact[value.toLowerCase()]) return compact[value.toLowerCase()];
  const tokens = value.toLowerCase().split(/[\s,/;&]+/).filter(Boolean);
  // Free-form strings are accepted by the original form. Ignore ambiguous schedules.
  return tokens.length && tokens.every((token) => token in weekdayNumbers) ? tokens.map((token) => weekdayNumbers[token]) : [];
}
function minutes(value: string) {
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
function timeLabel(value: number) {
  return `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, "0")} ${value >= 720 ? "PM" : "AM"}`;
}

/** Read adapter only. Existing tools continue to own all real mutations. */
export async function loadDashboard(): Promise<DashboardData> {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const data = emptyDashboard(date);
  const user = await getAuthUser();
  if (!user) return data;
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  data.name = typeof name === "string" ? name.split(" ")[0] : null;
  const [gpa, courses, tasks, schedule] = await Promise.allSettled([
    listGpaCourses(), listUserCourses(), listTodoItems(), listScheduleEvents(),
  ]);
  if ([gpa, courses, tasks, schedule].some((result) => result.status === "rejected")) {
    data.notice = "Some academic data could not be loaded. Open the original tools to try again.";
  }
  if (gpa.status === "fulfilled") {
    const mapped = gpa.value.map((course) => ({ ...course, units: Number(course.credits) }));
    data.semesterGpa = calculateSemesterGpa(mapped, data.term).gpa;
    data.cumulativeGpa = calculateCgpa(mapped).gpa;
    data.courses = gpa.value.filter((course) => `${course.season} ${course.year}` === data.term).map((course) => ({
      id: course.id, code: course.courseName, title: "", grade: [course.percentGrade ? `${course.percentGrade}%` : "", course.letterGrade].filter(Boolean).join(" · ") || "No grade yet",
    }));
  }
  if (tasks.status === "fulfilled") {
    const syllabusCourses = courses.status === "fulfilled" ? courses.value : [];
    data.assignments = tasks.value.map((task) => ({
      id: task.id, title: task.title, course: syllabusCourses.find((course) => course.id === task.courseId)?.courseNumber ?? "Assignment",
      dueDate: task.dueDate, completed: task.completed,
    }));
  }
  if (schedule.status === "fulfilled") {
    // Schedule records are untyped weekly blocks, so do not invent class metadata.
    data.events = schedule.value.map((event) => ({ ...event, day: (event.day + 6) % 7, kind: "study" }));
  }
  if (courses.status === "fulfilled") {
    const currentDay = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
    const clockParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const currentMinute = Number(clockParts.find((part) => part.type === "hour")?.value) * 60 + Number(clockParts.find((part) => part.type === "minute")?.value);
    const classSlots = courses.value.flatMap((course) => {
      const start = minutes(course.courseStart), end = minutes(course.courseEnd);
      if (start === null || end === null || end <= start) return [];
      return courseDays(course.courseDays).map((day) => ({ course, day, start, end }));
    });
    data.events.push(...classSlots.map((slot) => ({
      id: `class-${slot.course.id}-${slot.day}`, day: slot.day, start: slot.start, end: slot.end,
      title: `${slot.course.courseNumber} · ${slot.course.courseName}`, kind: "class" as const,
    })));
    const next = classSlots.map((slot) => ({ ...slot, distance: ((slot.day - currentDay + 7) % 7) * 1440 + slot.start - currentMinute }))
      .map((slot) => ({ ...slot, distance: slot.distance < 0 ? slot.distance + 7 * 1440 : slot.distance }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (next) data.nextClass = {
      title: next.course.courseName, code: next.course.courseNumber,
      professor: next.course.professorName || "Professor not provided", time: `${timeLabel(next.start)}–${timeLabel(next.end)}`,
      location: "Location not provided", status: `Up next · ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][next.day]}`,
    };
  }
  return data;
}
