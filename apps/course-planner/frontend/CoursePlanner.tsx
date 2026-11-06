"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  searchCourses,
  type CatalogCourse,
} from "@/apps/calculator-app/backend/course-service";
import type { TranscriptCourse } from "@/apps/course-planner/backend/parseTranscript";

function unitsLabel(course: CatalogCourse) {
  return course.units_min === course.units_max
    ? `${course.units_min} units`
    : `${course.units_min}–${course.units_max} units`;
}

type PreviousCourse = TranscriptCourse & { id: string };

const seasonOrder: Record<string, number> = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Fall: 3,
};

function termRank(title: string) {
  const [season, year = ""] = title.split(" ");
  const yearNumber = /^\d{4}$/.test(year) ? Number(year) : -1;
  return yearNumber * 10 + (seasonOrder[season] ?? -1);
}

function coursesByTerm(courses: PreviousCourse[]) {
  const groups = new Map<string, PreviousCourse[]>();

  for (const course of courses) {
    const title = [course.season, course.year].filter(Boolean).join(" ") || "Unscheduled";
    const group = groups.get(title);
    if (group) {
      group.push(course);
    } else {
      groups.set(title, [course]);
    }
  }

  return [...groups.entries()]
    .map(([title, termCourses]) => ({ title, courses: termCourses }))
    .sort((a, b) => termRank(b.title) - termRank(a.title));
}

export function CoursePlanner() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [planned, setPlanned] = useState<CatalogCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CatalogCourse | null>(null);
  const [previousCourses, setPreviousCourses] = useState<PreviousCourse[]>([]);
  const [transcriptStatus, setTranscriptStatus] = useState<
    "idle" | "reading" | "error"
  >("idle");
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const transcriptDialogRef = useRef<HTMLDialogElement>(null);

  const plannedIds = new Set(planned.map((course) => course.catalog_course_id));

  function openCourseModal(course: CatalogCourse) {
    setSelectedCourse(course);
    dialogRef.current?.showModal();
  }

  function closeCourseModal() {
    dialogRef.current?.close();
  }

  function openTranscriptModal() {
    setTranscriptStatus("idle");
    setTranscriptMessage("");
    transcriptDialogRef.current?.showModal();
  }

  function closeTranscriptModal() {
    transcriptDialogRef.current?.close();
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

  function removePreviousCourse(id: string) {
    setPreviousCourses((current) => current.filter((course) => course.id !== id));
  }

  async function uploadTranscript(file: File | undefined) {
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf") {
      setTranscriptStatus("error");
      setTranscriptMessage("Choose a PDF transcript.");
      return;
    }

    setTranscriptStatus("reading");
    setTranscriptMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-transcript", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        courses?: TranscriptCourse[];
        error?: string;
      };
      if (!response.ok || !data.courses) {
        throw new Error(data.error ?? "The transcript could not be read.");
      }

      setPreviousCourses(
        data.courses.map((course, index) => ({
          ...course,
          id: `${course.season}-${course.year}-${course.code}-${index}`,
        })),
      );
      setTranscriptStatus("idle");
      closeTranscriptModal();
    } catch (caught) {
      setTranscriptStatus("error");
      setTranscriptMessage(
        caught instanceof Error ? caught.message : "The transcript could not be read.",
      );
    }
  }

  const previousTerms = coursesByTerm(previousCourses);

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900">Course Planner</h1>
        <button
          type="button"
          onClick={openTranscriptModal}
          className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
        >
          Upload Transcript
        </button>
      </div>
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
                    onClick={() => openCourseModal(course)}
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

      {previousTerms.length > 0 ? (
        <section className="mt-8" aria-label="Previous courses">
          <h2 className="text-sm font-semibold text-neutral-900">Previous courses</h2>
          <div className="mt-6 flex flex-col gap-8">
            {previousTerms.map((section) => (
              <section key={section.title} aria-label={section.title}>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {section.title}
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.courses.map((course) => (
                    <li
                      key={course.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-base font-semibold text-neutral-900">
                          {course.code}
                        </h4>
                        <button
                          type="button"
                          aria-label={`Remove ${course.code}`}
                          onClick={() => removePreviousCourse(course.id)}
                          className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                      {course.title ? (
                        <p className="mt-1 text-sm text-neutral-600">{course.title}</p>
                      ) : null}
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs font-medium text-neutral-500">
                            Letter grade
                          </p>
                          <p className="mt-1 text-sm font-medium text-neutral-900">
                            {course.letterGrade || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-500">Credits</p>
                          <p className="mt-1 text-sm font-medium text-neutral-900">
                            {course.units || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-500">Grade points</p>
                          <p className="mt-1 text-sm font-medium text-neutral-900">
                            {course.points || "—"}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      ) : null}

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
                    onClick={() => openCourseModal(course)}
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
        {selectedCourse ? (
          <section aria-label="Prerequisites">
            <h2 className="text-sm font-semibold text-neutral-900">Prerequisites</h2>
            <p className="mt-1 text-sm whitespace-pre-wrap text-neutral-600">
              {selectedCourse.prerequisites ?? "None listed"}
            </p>
            <h2 className="mt-4 text-sm font-semibold text-neutral-900">Minimum grade</h2>
            <p className="mt-1 text-sm text-neutral-600">C-</p>
          </section>
        ) : null}
      </dialog>
      <dialog
        ref={transcriptDialogRef}
        aria-labelledby="upload-transcript-title"
        onClick={closeOnBackdropClick}
        className="fixed inset-0 m-auto h-fit max-h-[90vh] w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="upload-transcript-title"
            className="text-base font-semibold text-neutral-900"
          >
            Upload Transcript
          </h2>
          <button
            type="button"
            onClick={closeTranscriptModal}
            aria-label="Close"
            className="inline-flex size-6 items-center justify-center text-lg leading-none font-semibold text-neutral-900 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          Upload previous courses taken to plan around.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-medium text-neutral-900">Upload file</span>
            <span className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900">
              {transcriptStatus === "reading" ? "Reading…" : "Choose PDF"}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={transcriptStatus === "reading"}
              onChange={(event) => {
                const input = event.currentTarget;
                void uploadTranscript(input.files?.[0]).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>
          {transcriptMessage ? (
            <p className="mt-2 text-xs text-red-700" role="status">
              {transcriptMessage}
            </p>
          ) : null}
        </div>
      </dialog>
    </main>
  );
}
