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
