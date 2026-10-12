"use client";

import { useRef, useState } from "react";
import { AddCourseDialog, type AddCourseDialogHandle } from "./AddCourseDialog";
import { GpaResults } from "./GpaResults";

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

const quietButtonClassName =
  "rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50";
const activeButtonClassName =
  "rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white";

type CourseField = "season" | "year" | "letterGrade" | "percentGrade";

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

export function GpaCalculator() {
  const addCourseDialogRef = useRef<AddCourseDialogHandle>(null);
  const [courses, setCourses] = useState(initialCourses);
  const [editing, setEditing] = useState(false);
  const [whatIfEnabled, setWhatIfEnabled] = useState(false);
  const [whatIfChanges, setWhatIfChanges] = useState<
    Record<string, Partial<Pick<CourseGrade, CourseField>>>
  >({});

  function removeCourse(id: string) {
    setCourses((current) => current.filter((course) => course.id !== id));
    setWhatIfChanges((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateCourse(id: string, field: CourseField, value: string) {
    if (field === "percentGrade" && !isPercentDraft(value)) {
      return;
    }

    if (field === "year" && !isYearDraft(value)) {
      return;
    }

    if (whatIfEnabled) {
      setWhatIfChanges((current) => ({
        ...current,
        [id]: { ...current[id], [field]: value },
      }));
      return;
    }

    setCourses((current) =>
      current.map((course) =>
        course.id === id ? { ...course, [field]: value } : course,
      ),
    );
  }

  function toggleEditing() {
    if (whatIfEnabled) {
      setWhatIfChanges({});
      setWhatIfEnabled(false);
    }
    setEditing((current) => !current);
  }

  function toggleWhatIf() {
    setEditing(false);
    if (whatIfEnabled) {
      setWhatIfChanges({});
      setWhatIfEnabled(false);
      return;
    }
    setWhatIfEnabled(true);
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
  }

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <section aria-label="Course grades">
        <h1 className="text-lg font-semibold text-neutral-900">Courses</h1>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-neutral-900">
            {whatIfEnabled ? "What if mode" : null}
          </p>
          <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={whatIfEnabled}
            onClick={toggleWhatIf}
            className={whatIfEnabled ? activeButtonClassName : quietButtonClassName}
          >
            What if
          </button>
          <button
            type="button"
            aria-pressed={editing}
            onClick={toggleEditing}
            className={quietButtonClassName}
          >
            {editing ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => addCourseDialogRef.current?.open()}
            className={quietButtonClassName}
          >
            Add
          </button>
          </div>
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
          {courses.map((course) => {
            const row = whatIfEnabled
              ? { ...course, ...whatIfChanges[course.id] }
              : course;
            const adjusting = editing || whatIfEnabled;

            return (
            <li
              key={course.id}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-900 sm:p-4 sm:text-base"
            >
              <div className={`${columnClassName} min-w-0 flex-1`}>
                <span>{course.courseName}</span>
                {adjusting ? (
                  <span className="inline-flex items-center gap-3">
                    <select
                      aria-label={`Season for ${course.courseName}`}
                      value={row.season}
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
                      value={row.year}
                      onChange={(event) =>
                        updateCourse(course.id, "year", event.target.value)
                      }
                      placeholder="Year"
                      style={{ width: "4ch" }}
                      className="bg-transparent p-0 font-medium text-inherit outline-none placeholder:text-neutral-400"
                    />
                  </span>
                ) : (
                  <span>{[row.season, row.year].filter(Boolean).join(" ") || "—"}</span>
                )}
                {adjusting ? (
                  <select
                    aria-label={`Letter grade for ${course.courseName}`}
                    value={row.letterGrade}
                    onChange={(event) =>
                      updateCourse(course.id, "letterGrade", event.target.value)
                    }
                    className={controlClassName}
                    style={{
                      ...dropdownArrow,
                      width: dropdownWidth(row.letterGrade || "—"),
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
                  <span>{row.letterGrade || "—"}</span>
                )}
                {adjusting ? (
                  <span className="inline-flex items-center">
                    <input
                      aria-label={`Percent grade for ${course.courseName}`}
                      inputMode="decimal"
                      value={row.percentGrade}
                      onChange={(event) =>
                        updateCourse(course.id, "percentGrade", event.target.value)
                      }
                      placeholder="—"
                      style={{ width: `${Math.max(row.percentGrade.length, 1)}ch` }}
                      className="bg-transparent p-0 font-medium text-inherit outline-none placeholder:text-neutral-900"
                    />
                    {row.percentGrade ? "%" : null}
                  </span>
                ) : (
                  <span>{row.percentGrade ? `${row.percentGrade}%` : "—"}</span>
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
            );
          })}
        </ul>
      </section>
      {/* TODO: Replace placeholder values with the GPA engine results. */}
      <GpaResults
        semesterLabel="Fall 2026"
        semesterGpa={3.12}
        semesterUnits={10}
        cgpa={3.45}
        totalUnits={24}
      />
      <AddCourseDialog ref={addCourseDialogRef} onAdd={appendCourse} />
    </main>
  );
}
