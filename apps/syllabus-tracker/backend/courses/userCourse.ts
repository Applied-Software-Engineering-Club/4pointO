export const userCourseColumns = [
  "id",
  "course_number",
  "course_name",
  "course_days",
  "course_start",
  "course_end",
  "office_hours_days",
  "office_hours_start",
  "office_hours_end",
  "professor_name",
  "professor_email",
  "prerequisites",
  "homework_completed",
  "homework_total",
  "exams_completed",
  "exams_total",
  "projects_completed",
  "projects_total",
].join(", ");

export const progressSliderMax = 30;

export type CourseProgress = {
  homeworkCompleted: number;
  homeworkTotal: number;
  examsCompleted: number;
  examsTotal: number;
  projectsCompleted: number;
  projectsTotal: number;
};

export type UserCourseDraft = CourseProgress & {
  courseNumber: string;
  courseName: string;
  courseDays: string;
  courseStart: string;
  courseEnd: string;
  officeHoursDays: string;
  officeHoursStart: string;
  officeHoursEnd: string;
  professorName: string;
  professorEmail: string;
  prerequisites: string;
};

export type UserCourse = {
  id: string;
  courseNumber: string;
  courseName: string;
  courseDays: string;
  courseStart: string;
  courseEnd: string;
  officeHoursDays: string;
  officeHoursStart: string;
  officeHoursEnd: string;
  professorName: string;
  professorEmail: string;
  prerequisites: string;
  homeworkCompleted: number;
  homeworkTotal: number;
  examsCompleted: number;
  examsTotal: number;
  projectsCompleted: number;
  projectsTotal: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : "";
}

function clock(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return "";
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return "";
  }

  return `${match[1]}:${match[2]}`;
}

function count(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
    return null;
  }

  return parsed;
}

function progress(completedValue: unknown, totalValue: unknown) {
  const completed = count(completedValue);
  const total = count(totalValue);
  if (completed == null || total == null || completed > total) {
    return null;
  }

  return { completed, total };
}

function optionalText(value: string, maxLength: number, message: string) {
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(message);
  }

  return trimmed;
}

function wholeCount(value: number, message: string) {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new Error(message);
  }

  return value;
}

function progressPair(completed: number, total: number, message: string) {
  const done = wholeCount(completed, message);
  const max = wholeCount(total, message);
  if (done > max) {
    throw new Error(message);
  }

  return { completed: done, total: max };
}

export function courseProgress(value: CourseProgress): CourseProgress {
  const message = "Couldn't save this course.";
  const homework = progressPair(value.homeworkCompleted, value.homeworkTotal, message);
  const exams = progressPair(value.examsCompleted, value.examsTotal, message);
  const projects = progressPair(value.projectsCompleted, value.projectsTotal, message);

  return {
    homeworkCompleted: homework.completed,
    homeworkTotal: homework.total,
    examsCompleted: exams.completed,
    examsTotal: exams.total,
    projectsCompleted: projects.completed,
    projectsTotal: projects.total,
  };
}

function timePair(start: string, end: string, message: string) {
  const startClock = clock(start.trim());
  const endClock = clock(end.trim());
  const startFilled = start.trim().length > 0;
  const endFilled = end.trim().length > 0;

  if (!startFilled && !endFilled) {
    return { start: "", end: "" };
  }

  if (!startClock || !endClock || endClock <= startClock) {
    throw new Error(message);
  }

  return { start: startClock, end: endClock };
}

export function userCourseDraft(value: UserCourseDraft): UserCourseDraft {
  const message = "Couldn't save this course.";
  const courseNumber = value.courseNumber.trim();
  const courseName = value.courseName.trim();
  if (
    courseNumber.length < 1 ||
    courseNumber.length > 20 ||
    courseName.length < 1 ||
    courseName.length > 120
  ) {
    throw new Error(
      courseNumber && courseName ? message : "Enter a course number and name.",
    );
  }

  const courseTime = timePair(value.courseStart, value.courseEnd, "Enter a valid course time.");
  const officeHours = timePair(
    value.officeHoursStart,
    value.officeHoursEnd,
    "Enter a valid office hours time.",
  );
  const counts = courseProgress(value);
  const professorEmail = optionalText(value.professorEmail, 254, message);
  if (
    professorEmail &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(professorEmail)
  ) {
    throw new Error("Enter a valid email.");
  }

  return {
    courseNumber,
    courseName,
    courseDays: optionalText(value.courseDays, 40, message),
    courseStart: courseTime.start,
    courseEnd: courseTime.end,
    officeHoursDays: optionalText(value.officeHoursDays, 40, message),
    officeHoursStart: officeHours.start,
    officeHoursEnd: officeHours.end,
    professorName: optionalText(value.professorName, 120, message),
    professorEmail,
    prerequisites: optionalText(value.prerequisites, 500, message),
    ...counts,
  };
}

export function userCourseFromRow(row: Record<string, unknown>): UserCourse | null {
  const id = text(row.id, 36);
  const courseNumber = text(row.course_number, 20);
  const courseName = text(row.course_name, 120);
  const homework = progress(row.homework_completed, row.homework_total);
  const exams = progress(row.exams_completed, row.exams_total);
  const projects = progress(row.projects_completed, row.projects_total);

  if (!isUuid(id) || !courseNumber || !courseName || !homework || !exams || !projects) {
    return null;
  }

  return {
    id,
    courseNumber,
    courseName,
    courseDays: text(row.course_days, 40),
    courseStart: clock(row.course_start),
    courseEnd: clock(row.course_end),
    officeHoursDays: text(row.office_hours_days, 40),
    officeHoursStart: clock(row.office_hours_start),
    officeHoursEnd: clock(row.office_hours_end),
    professorName: text(row.professor_name, 120),
    professorEmail: text(row.professor_email, 254),
    prerequisites: text(row.prerequisites, 500),
    homeworkCompleted: homework.completed,
    homeworkTotal: homework.total,
    examsCompleted: exams.completed,
    examsTotal: exams.total,
    projectsCompleted: projects.completed,
    projectsTotal: projects.total,
  };
}
