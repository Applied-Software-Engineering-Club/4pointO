"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Course = {
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

const courses: Course[] = [
  {
    id: "cs-151",
    courseNumber: "CS 151",
    courseName: "Object Oriented Programming",
    courseDays: "TuTh",
    courseStart: "13:30",
    courseEnd: "14:30",
    officeHoursDays: "W",
    officeHoursStart: "15:00",
    officeHoursEnd: "16:00",
    professorName: "Ada Lovelace",
    professorEmail: "ada.lovelace@sjsu.edu",
    prerequisites: "CS 46B, MATH 42",
    homeworkCompleted: 4,
    homeworkTotal: 5,
    examsCompleted: 1,
    examsTotal: 2,
    projectsCompleted: 1,
    projectsTotal: 3,
  },
  {
    id: "cs-146",
    courseNumber: "CS 146",
    courseName: "Data Structures and Algorithms",
    courseDays: "MW",
    courseStart: "09:00",
    courseEnd: "10:15",
    officeHoursDays: "M",
    officeHoursStart: "14:00",
    officeHoursEnd: "15:30",
    professorName: "Grace Hopper",
    professorEmail: "grace.hopper@sjsu.edu",
    prerequisites: "CS 46B, MATH 30",
    homeworkCompleted: 6,
    homeworkTotal: 8,
    examsCompleted: 0,
    examsTotal: 2,
    projectsCompleted: 2,
    projectsTotal: 2,
  },
  {
    id: "math-161a",
    courseNumber: "MATH 161A",
    courseName: "Applied Probability and Statistics",
    courseDays: "MWF",
    courseStart: "11:00",
    courseEnd: "11:50",
    officeHoursDays: "F",
    officeHoursStart: "12:00",
    officeHoursEnd: "13:00",
    professorName: "Katherine Johnson",
    professorEmail: "katherine.johnson@sjsu.edu",
    prerequisites: "MATH 31",
    homeworkCompleted: 3,
    homeworkTotal: 10,
    examsCompleted: 1,
    examsTotal: 3,
    projectsCompleted: 0,
    projectsTotal: 1,
  },
];

type Progress = {
  label: string;
  completed: number;
  total: number;
};

function formatWindow(days: string, start: string, end: string) {
  const time = start && end ? `${start} - ${end}` : "";
  return [days, time].filter(Boolean).join(" ");
}

function ProgressBar({ label, completed, total }: Progress) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        <p className="text-xs text-neutral-500">
          {completed} / {total}
        </p>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={total === 0 ? 0 : completed}
        aria-valuetext={total === 0 ? "0 of 0" : `${completed} of ${total}`}
      >
        <div className="h-full rounded-full bg-neutral-900" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-wrap text-neutral-900">{value}</dd>
    </div>
  );
}

function CourseDetails({ course, onClose }: { course: Course; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const courseTime = formatWindow(course.courseDays, course.courseStart, course.courseEnd);
  const officeHours = formatWindow(
    course.officeHoursDays,
    course.officeHoursStart,
    course.officeHoursEnd,
  );
  const progress: Progress[] = [
    {
      label: "Homework",
      completed: course.homeworkCompleted,
      total: course.homeworkTotal,
    },
    {
      label: "Exams",
      completed: course.examsCompleted,
      total: course.examsTotal,
    },
    {
      label: "Projects",
      completed: course.projectsCompleted,
      total: course.projectsTotal,
    },
    {
      label: "Total",
      completed:
        course.homeworkCompleted + course.examsCompleted + course.projectsCompleted,
      total: course.homeworkTotal + course.examsTotal + course.projectsTotal,
    },
  ];

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-500">{course.courseNumber}</p>
            <h3 id={titleId} className="mt-1 text-lg font-semibold text-neutral-900">
              {course.courseName}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <dl className="mt-5 flex flex-col gap-3">
          <Detail label="Course time" value={courseTime} />
          <Detail label="Office hours" value={officeHours} />
          <Detail label="Professor" value={course.professorName} />
          {course.professorEmail ? (
            <div>
              <dt className="text-xs font-medium text-neutral-500">Email</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">
                <a
                  href={`mailto:${course.professorEmail}`}
                  className="underline hover:text-neutral-600"
                >
                  {course.professorEmail}
                </a>
              </dd>
            </div>
          ) : null}
          <Detail label="Prerequisites" value={course.prerequisites} />
        </dl>

        <div className="mt-6 flex flex-col gap-4">
          {progress.map((item) => (
            <ProgressBar key={item.label} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CourseList() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected = courses.find((course) => course.id === selectedId) ?? null;

  const closeCourse = useCallback(() => {
    setSelectedId(null);
    returnFocus.current?.focus();
  }, []);

  function openCourse(course: Course) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(course.id);
  }

  return (
    <section aria-label="Current courses" className="mt-6">
      <h2 className="text-lg font-semibold text-neutral-900">Courses</h2>
      <ul className="mt-4 flex max-w-3xl flex-col gap-3">
        {courses.map((course) => (
          <li key={course.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => openCourse(course)}
              className="flex h-24 w-full items-center gap-6 border border-neutral-200 bg-neutral-50 px-5 text-left shadow-sm hover:border-neutral-300 hover:bg-white"
            >
              <p className="w-28 shrink-0 text-sm font-medium text-neutral-500">
                {course.courseNumber}
              </p>
              <h3 className="text-base font-semibold text-neutral-900">{course.courseName}</h3>
            </button>
          </li>
        ))}
      </ul>
      {selected ? <CourseDetails course={selected} onClose={closeCourse} /> : null}
    </section>
  );
}
