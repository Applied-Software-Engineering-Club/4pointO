"use client";

import { useRef, useState, type MouseEvent } from "react";
import catalog from "@/utils/data/course-sample.json";

type CourseGrade = {
  id: string;
  courseName: string;
  semester: string;
  letterGrade: string;
  percentGrade: string;
};

const initialCourses: CourseGrade[] = [
  {
    id: "cs-151",
    courseName: "CS 151",
    semester: "Fall 2026",
    letterGrade: "B+",
    percentGrade: "89.51%",
  },
  {
    id: "cs-160",
    courseName: "CS 160",
    semester: "Fall 2026",
    letterGrade: "B+",
    percentGrade: "89.51%",
  },
];

const columnClassName = "grid grid-cols-4 gap-2 whitespace-nowrap sm:gap-8";

export function GpaCalculator() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [courses, setCourses] = useState(initialCourses);

  function openCourseModal() {
    dialogRef.current?.showModal();
  }

  function closeCourseModal() {
    dialogRef.current?.close();
  }

  function removeCourse(id: string) {
    setCourses((current) => current.filter((course) => course.id !== id));
  }

  function addCourse(course: (typeof catalog.courses)[number]) {
    setCourses((current) => [
      ...current,
      {
        id: `${course.catalog_course_id}-${crypto.randomUUID()}`,
        courseName: course.code,
        semester: "—",
        letterGrade: "—",
        percentGrade: "—",
      },
    ]);
    closeCourseModal();
  }

  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <section aria-label="Course grades">
        <h1 className="text-lg font-semibold text-neutral-900">Courses</h1>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={openCourseModal}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Add
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 px-[13px] text-xs text-neutral-500 sm:px-[17px] sm:text-sm">
          <div className={`${columnClassName} min-w-0 flex-1`}>
            <span>Course</span>
            <span>Semester</span>
            <span>Letter grade</span>
            <span>Percent grade</span>
          </div>
          <span className="size-6 shrink-0" aria-hidden="true" />
        </div>
        <ul className="mt-2 flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-900 sm:p-4 sm:text-base"
            >
              <div className={`${columnClassName} min-w-0 flex-1`}>
                <span>{course.courseName}</span>
                <span>{course.semester}</span>
                <span>{course.letterGrade}</span>
                <span>{course.percentGrade}</span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${course.courseName}`}
                onClick={() => removeCourse(course.id)}
                className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-red-600 hover:text-red-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
      <dialog
        ref={dialogRef}
        aria-labelledby="add-course-title"
        onClick={closeOnBackdropClick}
        className="fixed inset-0 m-auto h-fit max-h-[min(32rem,calc(100vh-3rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="add-course-title" className="text-lg font-semibold">
            Add a course
          </h2>
          <button
            type="button"
            onClick={closeCourseModal}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {catalog.courses.map((course) => (
            <li key={course.catalog_course_id}>
              <button
                type="button"
                onClick={() => addCourse(course)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left hover:bg-neutral-100"
              >
                <p className="text-sm font-medium">{course.code}</p>
                <p className="mt-1 text-sm text-neutral-600">{course.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {course.units_min === course.units_max
                    ? `${course.units_min} units`
                    : `${course.units_min}–${course.units_max} units`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </main>
  );
}
