"use client";

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type MouseEvent, type Ref } from "react";
import catalog from "@/utils/data/course-sample.json";
import { CourseDetails } from "./CourseDetails";

type CatalogCourse = (typeof catalog.courses)[number];

export type AddCourseDialogHandle = {
  open: () => void;
};

type AddCourseDialogProps = {
  ref?: Ref<AddCourseDialogHandle>;
  onAdd: (idPrefix: string, courseName: string) => void;
};

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

export function AddCourseDialog({ ref, onAdd }: AddCourseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);


  useImperativeHandle(ref, () => ({
    open() {
      setLoading(true);
      setModalOpen(true);
      dialogRef.current?.showModal();
    },
  }));

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

  function closeCourseModal() {
    dialogRef.current?.close();
  }

  function resetCourseModal() {
    setModalOpen(false);
    setEntryMode("search");
    setQuery("");
    setManualName("");
    setManualError(null);
    setExpandedId(null);
  }

  function addCourse(idPrefix: string, courseName: string) {
    onAdd(idPrefix, courseName);
    closeCourseModal();
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

    addCourse("manual", courseName);
  }

  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  return (
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
                {results.map((course) => {
                  const detailsOpen = expandedId === course.catalog_course_id;

                  return (
                    <li
                      key={course.catalog_course_id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <p className="text-sm font-medium">{course.code}</p>
                      <p className="mt-1 text-sm text-neutral-600">{course.title}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {course.units_min === course.units_max
                          ? `${course.units_min} units`
                          : `${course.units_min}–${course.units_max} units`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-expanded={detailsOpen}
                          aria-controls={`course-details-${course.catalog_course_id}`}
                          onClick={() =>
                            setExpandedId((current) =>
                              current === course.catalog_course_id
                                ? null
                                : course.catalog_course_id,
                            )
                          }
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
                        >
                          {detailsOpen ? "Hide details" : "View details"}
                        </button>
                        <button
                          type="button"
                          onClick={() => addCourse(course.catalog_course_id, course.code)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
                        >
                          Add course
                        </button>
                      </div>
                      {detailsOpen ? (
                        <div
                          id={`course-details-${course.catalog_course_id}`}
                          className="mt-3"
                        >
                          <CourseDetails course={course} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
