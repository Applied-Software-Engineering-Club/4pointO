"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  searchCourses,
  type CatalogCourse,
} from "@/apps/calculator-app/backend/course-service";

function unitsLabel(course: CatalogCourse) {
  return course.units_min === course.units_max
    ? `${course.units_min} units`
    : `${course.units_min}–${course.units_max} units`;
}

export function CoursePlanner() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [planned, setPlanned] = useState<CatalogCourse[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const plannedIds = new Set(planned.map((course) => course.catalog_course_id));

  function openCourseModal() {
    dialogRef.current?.showModal();
  }

  function closeCourseModal() {
    dialogRef.current?.close();
  }

  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setSearchError(null);
    setLoading(true);

    try {
      const normalized = query.trim();
      setResults(normalized ? await searchCourses(normalized) : []);
    } catch (error) {
      setResults([]);
      setSearchError(
        error instanceof Error ? error.message : "Unable to search courses.",
      );
    } finally {
      setLoading(false);
    }
  }

  function addCourse(course: CatalogCourse) {
    setPlanned((current) =>
      current.some((item) => item.catalog_course_id === course.catalog_course_id)
        ? current
        : [...current, course],
    );
  }

  function removeCourse(id: string) {
    setPlanned((current) =>
      current.filter((course) => course.catalog_course_id !== id),
    );
  }

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <h1 className="text-lg font-semibold text-neutral-900">Course Planner</h1>
      <form className="mt-4 max-w-lg" onSubmit={runSearch}>
        <label
          className="block text-sm font-medium text-neutral-900"
          htmlFor="course-search"
        >
          Search
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-neutral-200 pr-1">
          <input
            id="course-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter course code, title, or department."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-normal text-neutral-900 outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mt-4 max-w-lg" aria-live="polite">
        {!hasSearched ? null : loading ? (
          <p className="text-sm text-neutral-500">Loading</p>
        ) : searchError ? (
          <p className="text-sm text-red-600">{searchError}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-neutral-500">No courses found</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((course) => {
              const added = plannedIds.has(course.catalog_course_id);

              return (
                <li
                  key={course.catalog_course_id}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <button
                    type="button"
                    onClick={openCourseModal}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-medium">{course.code}</p>
                    <p className="mt-1 text-sm text-neutral-600">{course.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {unitsLabel(course)}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addCourse(course)}
                    className="mt-3 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
                  >
                    {added ? "Added" : "Add course"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <section className="mt-8" aria-label="Planned courses">
        <h2 className="text-sm font-semibold text-neutral-900">Your plan</h2>
        {planned.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Search the catalog and add a course.
          </p>
        ) : (
          <ul className="mt-3 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {planned.map((course) => (
              <li
                key={course.catalog_course_id}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={openCourseModal}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="text-base font-semibold text-neutral-900">
                      {course.code}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600">{course.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {unitsLabel(course)}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${course.code}`}
                    onClick={() => removeCourse(course.catalog_course_id)}
                    className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <dialog
        ref={dialogRef}
        aria-label="Course"
        onClick={closeOnBackdropClick}
        className="fixed inset-0 m-auto h-64 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeCourseModal}
            aria-label="Close"
            className="inline-flex size-6 items-center justify-center text-lg leading-none font-semibold text-neutral-900 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
      </dialog>
    </main>
  );
}
