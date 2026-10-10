"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import catalog from "@/utils/data/course-sample.json";

type CourseGrade = {
  id: string;
  courseName: string;
  season: string;
  year: string;
  letterGrade: string;
  percentGrade: string;
};

const letterGrades = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
  "CR",
  "NC",
  "W",
  "WU",
  "I",
];

const seasons = ["Fall", "Spring", "Summer"];
const defaultYear = String(new Date().getFullYear());

const initialCourses: CourseGrade[] = [
  {
    id: "cs-151",
    courseName: "CS 151",
    season: "Fall",
    year: "2026",
    letterGrade: "B+",
    percentGrade: "89.51",
  },
  {
    id: "cs-160",
    courseName: "CS 160",
    season: "Fall",
    year: "2026",
    letterGrade: "B+",
    percentGrade: "89.51",
  },
];

const columnClassName = "grid grid-cols-4 gap-2 whitespace-nowrap sm:gap-8";
const controlClassName =
  "cursor-pointer appearance-none justify-self-start border-0 bg-transparent bg-[length:0.65rem] bg-[position:right_center] bg-no-repeat p-0 pr-[0.85rem] font-medium text-inherit outline-none";
const dropdownArrow = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' stroke='%23737373' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
};

function dropdownWidth(label: string) {
  return `calc(${Math.max(label.length, 1)}ch + 0.85rem)`;
}

function isYearDraft(value: string) {
  return /^\d{0,4}$/.test(value);
}

function isPercentDraft(value: string) {
  if (value === "") {
    return true;
  }

  return /^\d{1,3}(\.\d{0,2})?$/.test(value) && Number(value) <= 100;
}

type CatalogCourse = (typeof catalog.courses)[number];

function searchCatalog(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return catalog.courses;
  }

  return catalog.courses.filter((course) => {
    return (
      course.code.toLowerCase().includes(normalized) ||
      course.title.toLowerCase().includes(normalized)
    );
  });
}

export function GpaCalculator() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [courses, setCourses] = useState(initialCourses);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (!modalOpen || entryMode !== "search") {
      return;
    }

    setLoading(true);
    const timeout = window.setTimeout(() => {
      setResults(searchCatalog(query));
      setLoading(false);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [modalOpen, query, entryMode]);

  function openCourseModal() {
    setLoading(true);
    setModalOpen(true);
    dialogRef.current?.showModal();
  }

  function closeCourseModal() {
    dialogRef.current?.close();
  }

  function resetCourseModal() {
    setModalOpen(false);
    setEntryMode("search");
    setQuery("");
    setManualName("");
    setManualError(null);
  }

  function removeCourse(id: string) {
    setCourses((current) => current.filter((course) => course.id !== id));
  }

  function updateCourse(
    id: string,
    field: "season" | "year" | "letterGrade" | "percentGrade",
    value: string,
  ) {
    if (field === "percentGrade" && !isPercentDraft(value)) {
      return;
    }

    if (field === "year" && !isYearDraft(value)) {
      return;
    }

    setCourses((current) =>
      current.map((course) =>
        course.id === id ? { ...course, [field]: value } : course,
      ),
    );
  }

  function appendCourse(idPrefix: string, courseName: string) {
    setCourses((current) => [
      ...current,
      {
        id: `${idPrefix}-${crypto.randomUUID()}`,
        courseName,
        season: "Fall",
        year: defaultYear,
        letterGrade: "",
        percentGrade: "",
      },
    ]);
    closeCourseModal();
  }

  function addCourse(course: CatalogCourse) {
    appendCourse(course.catalog_course_id, course.code);
  }

  function openManualEntry(prefill = "") {
    setManualName(prefill);
    setManualError(null);
    setEntryMode("manual");
  }

  function addManualCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const courseName = manualName.trim();
    if (!courseName) {
      setManualError("Enter a course name.");
      return;
    }

    appendCourse("manual", courseName);
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
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing((current) => !current)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            {editing ? "Done" : "Edit"}
          </button>
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
                {editing ? (
                  <span className="inline-flex items-center gap-3">
                    <select
                      aria-label={`Season for ${course.courseName}`}
                      value={course.season}
                      onChange={(event) =>
                        updateCourse(course.id, "season", event.target.value)
                      }
                      className={`${controlClassName} w-fit [field-sizing:content]`}
                      style={dropdownArrow}
                    >
                      {seasons.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Year for ${course.courseName}`}
                      inputMode="numeric"
                      value={course.year}
                      onChange={(event) =>
                        updateCourse(course.id, "year", event.target.value)
                      }
                      placeholder="Year"
                      style={{ width: "4ch" }}
                      className="bg-transparent p-0 font-medium text-inherit outline-none placeholder:text-neutral-400"
                    />
                  </span>
                ) : (
                  <span>{[course.season, course.year].filter(Boolean).join(" ") || "—"}</span>
                )}
                {editing ? (
                  <select
                    aria-label={`Letter grade for ${course.courseName}`}
                    value={course.letterGrade}
                    onChange={(event) =>
                      updateCourse(course.id, "letterGrade", event.target.value)
                    }
                    className={controlClassName}
                    style={{
                      ...dropdownArrow,
                      width: dropdownWidth(course.letterGrade || "—"),
                    }}
                  >
                    <option value="">—</option>
                    {letterGrades.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{course.letterGrade || "—"}</span>
                )}
                {editing ? (
                  <span className="inline-flex items-center">
                    <input
                      aria-label={`Percent grade for ${course.courseName}`}
                      inputMode="decimal"
                      value={course.percentGrade}
                      onChange={(event) =>
                        updateCourse(course.id, "percentGrade", event.target.value)
                      }
                      placeholder="—"
                      style={{ width: `${Math.max(course.percentGrade.length, 1)}ch` }}
                      className="bg-transparent p-0 font-medium text-inherit outline-none placeholder:text-neutral-900"
                    />
                    {course.percentGrade ? "%" : null}
                  </span>
                ) : (
                  <span>{course.percentGrade ? `${course.percentGrade}%` : "—"}</span>
                )}
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
        onClose={resetCourseModal}
        className="fixed inset-0 m-auto h-fit max-h-[min(32rem,calc(100vh-3rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="add-course-title" className="text-lg font-semibold">
            Add a course
          </h2>
          <button
            type="button"
            onClick={closeCourseModal}
            aria-label="Close"
            className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-neutral-900 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            aria-pressed={entryMode === "search"}
            onClick={() => setEntryMode("search")}
            className={
              entryMode === "search"
                ? "rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
            }
          >
            Search
          </button>
          <button
            type="button"
            aria-pressed={entryMode === "manual"}
            onClick={() => openManualEntry(manualName || query.trim())}
            className={
              entryMode === "manual"
                ? "rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
            }
          >
            Enter manually
          </button>
        </div>
        {entryMode === "manual" ? (
          <form className="mt-4" onSubmit={addManualCourse} noValidate>
            <label className="block text-sm font-medium text-neutral-900" htmlFor="manual-course-name">
              Course
              <input
                id="manual-course-name"
                value={manualName}
                onChange={(event) => {
                  setManualName(event.target.value);
                  setManualError(null);
                }}
                aria-invalid={manualError ? true : undefined}
                aria-describedby={manualError ? "manual-course-error" : undefined}
                placeholder="Course name"
                autoFocus
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900"
              />
            </label>
            {manualError ? (
              <p id="manual-course-error" className="mt-2 text-sm text-red-600">
                {manualError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
              >
                Add course
              </button>
            </div>
          </form>
        ) : (
          <>
            <label className="mt-4 block text-sm font-medium text-neutral-900">
              Search
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setLoading(true);
                  setQuery(event.target.value);
                }}
                placeholder="Search courses"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900"
              />
            </label>
            <div className="mt-4" aria-live="polite">
              {!modalOpen ? null : loading ? (
                <p className="text-sm text-neutral-500">Loading</p>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-neutral-500">No courses found</p>
                  <button
                    type="button"
                    onClick={() => openManualEntry(query.trim())}
                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
                  >
                    Enter course manually
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {results.map((course) => (
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
              )}
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
