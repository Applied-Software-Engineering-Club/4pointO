"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { addUserCourse } from "@/apps/syllabus-tracker/backend/courses/addUserCourse";
import { listUserCourses } from "@/apps/syllabus-tracker/backend/courses/listUserCourses";
import { updateCourseProgress } from "@/apps/syllabus-tracker/backend/courses/updateCourseProgress";
import {
  progressSliderMax,
  type CourseProgress,
  type UserCourse,
  type UserCourseDraft,
} from "@/apps/syllabus-tracker/backend/courses/userCourse";

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

const progressRows = [
  { label: "Homework", completed: "homeworkCompleted", total: "homeworkTotal" },
  { label: "Exams", completed: "examsCompleted", total: "examsTotal" },
  { label: "Projects", completed: "projectsCompleted", total: "projectsTotal" },
] as const;

function progressOf(course: CourseProgress): CourseProgress {
  return {
    homeworkCompleted: course.homeworkCompleted,
    homeworkTotal: course.homeworkTotal,
    examsCompleted: course.examsCompleted,
    examsTotal: course.examsTotal,
    projectsCompleted: course.projectsCompleted,
    projectsTotal: course.projectsTotal,
  };
}

function ProgressControls({
  value,
  onChange,
}: {
  value: CourseProgress;
  onChange: (value: CourseProgress) => void;
}) {
  const totalCompleted =
    value.homeworkCompleted + value.examsCompleted + value.projectsCompleted;
  const totalMax = value.homeworkTotal + value.examsTotal + value.projectsTotal;

  function change(key: keyof CourseProgress, nextValue: number) {
    const next = { ...value, [key]: nextValue };
    for (const row of progressRows) {
      if (next[row.completed] > next[row.total]) {
        next[row.completed] = next[row.total];
      }
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-5">
      {progressRows.map((row) => {
        const completed = value[row.completed];
        const total = value[row.total];
        const limit = Math.max(progressSliderMax, total);

        return (
          <div key={row.label}>
            <p className="text-sm font-medium text-neutral-900">{row.label}</p>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200"
              role="progressbar"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={Math.max(total, 1)}
              aria-valuenow={total === 0 ? 0 : completed}
              aria-valuetext={total === 0 ? "0 of 0" : `${completed} of ${total}`}
            >
              <div
                className="h-full rounded-full bg-neutral-900"
                style={{ width: total === 0 ? "0%" : `${(completed / total) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex min-w-0 flex-1" role="group" aria-label={`${row.label} ticks`}>
                {Array.from({ length: total }, (_, index) => {
                  const on = index < completed;

                  return (
                    <button
                      key={index}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${row.label} ${index + 1} of ${total}`}
                      onClick={() =>
                        change(row.completed, index + 1 === completed ? index : index + 1)
                      }
                      className="flex h-4 min-w-0 flex-1 items-center justify-center"
                    >
                      <span
                        className={`size-1.5 rounded-full ${on ? "bg-neutral-900" : "bg-neutral-300"}`}
                      />
                    </button>
                  );
                })}
              </div>
              <input
                type="number"
                inputMode="numeric"
                aria-label={`${row.label} max`}
                min={0}
                max={limit}
                value={total}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next >= 0 && next <= limit) {
                    change(row.total, next);
                  }
                }}
                className="w-12 shrink-0 rounded border border-neutral-200 px-1 py-0.5 text-right text-xs text-neutral-900 outline-none"
              />
            </div>
          </div>
        );
      })}
      <ProgressBar label="Total" completed={totalCompleted} total={totalMax} />
    </div>
  );
}

function CourseDetails({
  course,
  onClose,
  onProgress,
}: {
  course: UserCourse;
  onClose: () => void;
  onProgress: (course: UserCourse) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const courseTime = formatWindow(course.courseDays, course.courseStart, course.courseEnd);
  const officeHours = formatWindow(
    course.officeHoursDays,
    course.officeHoursStart,
    course.officeHoursEnd,
  );
  const [progress, setProgress] = useState<CourseProgress>(() => progressOf(course));
  const [progressError, setProgressError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function saveProgress() {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setProgressError(null);

    try {
      onProgress(await updateCourseProgress(course.id, progress));
    } catch (caught) {
      setProgressError(caught instanceof Error ? caught.message : "Couldn't save this course.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

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

        <div className="mt-6">
          <ProgressControls value={progress} onChange={setProgress} />
          {progressError ? <p className="mt-3 text-sm text-red-700">{progressError}</p> : null}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void saveProgress()}
              disabled={saving}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const emptyDraft: UserCourseDraft = {
  courseNumber: "",
  courseName: "",
  courseDays: "",
  courseStart: "",
  courseEnd: "",
  officeHoursDays: "",
  officeHoursStart: "",
  officeHoursEnd: "",
  professorName: "",
  professorEmail: "",
  prerequisites: "",
  homeworkCompleted: 0,
  homeworkTotal: 0,
  examsCompleted: 0,
  examsTotal: 0,
  projectsCompleted: 0,
  projectsTotal: 0,
};

const fieldClassName =
  "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-400";

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "time" | "email";
  required?: boolean;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-neutral-500">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
    </div>
  );
}

function AddCourseDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (course: UserCourse) => void;
}) {
  const titleId = useId();
  const numberRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    numberRef.current?.focus();

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

  function update(field: keyof UserCourseDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      onSave(await addUserCourse(draft));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this course.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={save}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold text-neutral-900">
            Add course
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add course"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="course-number" className="text-xs font-medium text-neutral-500">
              Course number
            </label>
            <input
              ref={numberRef}
              id="course-number"
              required
              value={draft.courseNumber}
              onChange={(event) => update("courseNumber", event.target.value)}
              placeholder="CS 151"
              className={fieldClassName}
            />
          </div>
          <Field
            label="Course name"
            required
            value={draft.courseName}
            onChange={(value) => update("courseName", value)}
          />
          <Field
            label="Course days"
            value={draft.courseDays}
            onChange={(value) => update("courseDays", value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Course start"
              type="time"
              value={draft.courseStart}
              onChange={(value) => update("courseStart", value)}
            />
            <Field
              label="Course end"
              type="time"
              value={draft.courseEnd}
              onChange={(value) => update("courseEnd", value)}
            />
          </div>
          <Field
            label="Office hours days"
            value={draft.officeHoursDays}
            onChange={(value) => update("officeHoursDays", value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Hours start"
              type="time"
              value={draft.officeHoursStart}
              onChange={(value) => update("officeHoursStart", value)}
            />
            <Field
              label="Hours end"
              type="time"
              value={draft.officeHoursEnd}
              onChange={(value) => update("officeHoursEnd", value)}
            />
          </div>
          <Field
            label="Professor"
            value={draft.professorName}
            onChange={(value) => update("professorName", value)}
          />
          <Field
            label="Email"
            type="email"
            value={draft.professorEmail}
            onChange={(value) => update("professorEmail", value)}
          />
          <div className="sm:col-span-2">
            <label htmlFor="prerequisites" className="text-xs font-medium text-neutral-500">
              Prerequisites
            </label>
            <textarea
              id="prerequisites"
              value={draft.prerequisites}
              onChange={(event) => update("prerequisites", event.target.value)}
              rows={2}
              className={fieldClassName}
            />
          </div>
        </div>

        <div className="mt-6">
          <ProgressControls
            value={draft}
            onChange={(progress) => setDraft((current) => ({ ...current, ...progress }))}
          />
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CourseList() {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected = courses.find((course) => course.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;

    listUserCourses()
      .then((loaded) => {
        if (!active) {
          return;
        }

        setCourses(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setCourses([]);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const closeCourse = useCallback(() => {
    setSelectedId(null);
    returnFocus.current?.focus();
  }, []);

  const closeAdd = useCallback(() => {
    setAdding(false);
    returnFocus.current?.focus();
  }, []);

  const saveProgress = useCallback((course: UserCourse) => {
    setCourses((current) =>
      current.map((item) => (item.id === course.id ? course : item)),
    );
  }, []);

  const saveAdd = useCallback((course: UserCourse) => {
    setCourses((current) => [...current, course]);
    setAdding(false);
    returnFocus.current?.focus();
  }, []);

  function openCourse(course: UserCourse) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(course.id);
  }

  return (
    <section aria-label="Current courses" className="mt-6">
      <h2 className="text-lg font-semibold text-neutral-900">Courses</h2>
      {status === "loading" ? (
        <p className="mt-4 text-sm text-neutral-500">Loading courses…</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-4 text-sm text-red-700">Couldn't load your courses.</p>
      ) : null}
      {status === "ready" ? (
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
          <li>
            <button
              type="button"
              aria-label="Add course"
              aria-haspopup="dialog"
              onClick={() => {
                returnFocus.current =
                  document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setAdding(true);
              }}
              className="flex h-24 w-full items-center justify-center border border-neutral-200 bg-neutral-50 text-neutral-900 shadow-sm hover:border-neutral-300 hover:bg-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        </ul>
      ) : null}
      {selected ? (
        <CourseDetails course={selected} onClose={closeCourse} onProgress={saveProgress} />
      ) : null}
      {adding ? <AddCourseDialog onClose={closeAdd} onSave={saveAdd} /> : null}
    </section>
  );
}
