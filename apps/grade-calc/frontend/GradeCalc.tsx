"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { addUserCourse } from "@/apps/syllabus-tracker/backend/courses/addUserCourse";
import { listUserCourses } from "@/apps/syllabus-tracker/backend/courses/listUserCourses";
import type { UserCourse, UserCourseDraft } from "@/apps/syllabus-tracker/backend/courses/userCourse";

type Category = { id: string; name: string; weight: number };
type Assignment = {
  id: string;
  name: string;
  earned: number;
  total: number;
  categoryId: string;
  hypothetical?: boolean;
};

type GradeCourse = Pick<UserCourse, "id" | "courseNumber" | "courseName">;

const emptyCourseDraft: UserCourseDraft = {
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

const inputClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900";
const buttonClass =
  "rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50";
const removeClass =
  "text-sm text-neutral-500 hover:text-neutral-900 hover:underline";

function formatPercent(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

function categoryAverage(categoryId: string, assignments: Assignment[]) {
  const inCategory = assignments.filter((a) => a.categoryId === categoryId);
  const total = inCategory.reduce((sum, a) => sum + a.total, 0);
  if (inCategory.length === 0 || total === 0) return null;
  const earned = inCategory.reduce((sum, a) => sum + a.earned, 0);
  return (earned / total) * 100;
}

// Weighted average over categories that have graded work, so ungraded
// categories don't drag the current grade down.
function courseGrade(categories: Category[], assignments: Assignment[]) {
  let weighted = 0;
  let weightUsed = 0;

  for (const category of categories) {
    const average = categoryAverage(category.id, assignments);
    if (average === null) continue;
    weighted += average * category.weight;
    weightUsed += category.weight;
  }

  return weightUsed === 0 ? null : weighted / weightUsed;
}

function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="mb-3 text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

type EditableValueProps = {
  children: ReactNode;
  draftValue: string;
  inputType: "text" | "number";
  label: string;
  // Return true if the new value was accepted.
  onCommit: (draft: string) => boolean;
  className?: string;
};

// Shows its children; click to swap in a small input in the same spot.
// Enter or clicking away saves, Escape cancels.
function EditableValue({
  children,
  draftValue,
  inputType,
  label,
  onCommit,
  className = "",
}: EditableValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(draftValue);
  const [invalid, setInvalid] = useState(false);
  const finished = useRef(false);

  function start() {
    finished.current = false;
    setDraft(draftValue);
    setInvalid(false);
    setEditing(true);
  }

  function finish() {
    finished.current = true;
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title="Click to edit"
        className={`rounded text-left hover:bg-neutral-100 ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <input
      type="text"
      inputMode={inputType === "number" ? "decimal" : undefined}
      aria-label={label}
      value={draft}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") finish();
        if (e.key === "Enter") {
          if (onCommit(draft)) finish();
          else setInvalid(true);
        }
      }}
      onBlur={() => {
        if (finished.current) return;
        onCommit(draft);
        finish();
      }}
      style={{ width: `${Math.max(draft.length, 2) + 1}ch` }}
      className={`rounded border bg-white px-1 text-sm text-neutral-900 outline-none ${
        invalid ? "border-red-500" : "border-neutral-400"
      } ${inputType === "text" ? "w-full" : ""}`}
    />
  );
}

type AssignmentRowProps = {
  assignment: Assignment;
  categories: Category[];
  onUpdate: AssignmentsPanelProps["onUpdate"];
  onRemove: (id: string) => void;
};

function AssignmentRow({
  assignment,
  categories,
  onUpdate,
  onRemove,
}: AssignmentRowProps) {
  const [editingCategory, setEditingCategory] = useState(false);
  const categoryName = categories.find(
    (c) => c.id === assignment.categoryId,
  )?.name;
  const percent = (assignment.earned / assignment.total) * 100;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <EditableValue
          inputType="text"
          label="Assignment name"
          draftValue={assignment.name}
          onCommit={(draft) => {
            if (!draft.trim()) return false;
            onUpdate(assignment.id, { name: draft.trim() });
            return true;
          }}
          className="block max-w-full truncate text-sm text-neutral-900"
        >
          {assignment.name}
        </EditableValue>
        {editingCategory ? (
          <select
            aria-label="Weight category"
            value={assignment.categoryId}
            autoFocus
            onChange={(e) => {
              onUpdate(assignment.id, { categoryId: e.target.value });
              setEditingCategory(false);
            }}
            onBlur={() => setEditingCategory(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingCategory(false);
            }}
            className="rounded border border-neutral-400 bg-white px-1 text-xs text-neutral-900"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setEditingCategory(true)}
            title="Click to change category"
            className="block rounded text-left text-xs text-neutral-500 hover:bg-neutral-100"
          >
            {categoryName}
          </button>
        )}
        {assignment.hypothetical ? (
          <span className="text-xs font-medium text-blue-600">What-if</span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="flex items-center gap-1 text-sm text-neutral-900">
          <EditableValue
            inputType="number"
            label="Points earned"
            draftValue={String(assignment.earned)}
            onCommit={(draft) => {
              const value = Number(draft);
              if (draft.trim() === "" || !Number.isFinite(value) || value < 0)
                return false;
              onUpdate(assignment.id, { earned: value });
              return true;
            }}
          >
            {assignment.earned}
          </EditableValue>
          <span className="text-neutral-500">/</span>
          <EditableValue
            inputType="number"
            label="Points possible"
            draftValue={String(assignment.total)}
            onCommit={(draft) => {
              const value = Number(draft);
              if (draft.trim() === "" || !Number.isFinite(value) || value <= 0)
                return false;
              onUpdate(assignment.id, { total: value });
              return true;
            }}
          >
            {assignment.total}
          </EditableValue>
          <EditableValue
            inputType="number"
            label="Percent"
            draftValue={String(Number(percent.toFixed(2)))}
            onCommit={(draft) => {
              const value = Number(draft);
              if (draft.trim() === "" || !Number.isFinite(value) || value < 0)
                return false;
              // Keep points possible; change points earned to match.
              onUpdate(assignment.id, {
                earned: Number(((value / 100) * assignment.total).toFixed(2)),
              });
              return true;
            }}
            className="text-neutral-500"
          >
            ({formatPercent(percent)})
          </EditableValue>
        </span>
        <button
          type="button"
          onClick={() => onRemove(assignment.id)}
          aria-label={`Remove ${assignment.name}`}
          className={removeClass}
        >
          Remove
        </button>
      </span>
    </li>
  );
}

type AssignmentsPanelProps = {
  categories: Category[];
  assignments: Assignment[];
  onAdd: (assignment: Omit<Assignment, "id">) => void;
  onUpdate: (
    id: string,
    changes: Partial<
      Pick<Assignment, "name" | "earned" | "total" | "categoryId">
    >,
  ) => void;
  onRemove: (id: string) => void;
};

function AssignmentsPanel({
  categories,
  assignments,
  onAdd,
  onUpdate,
  onRemove,
}: AssignmentsPanelProps) {
  const [name, setName] = useState("");
  const [earned, setEarned] = useState("");
  const [total, setTotal] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const earnedNumber = Number(earned);
    const totalNumber = Number(total);

    if (!name.trim()) return setError("Enter an assignment name.");
    if (
      earned.trim() === "" ||
      !Number.isFinite(earnedNumber) ||
      earnedNumber < 0
    )
      return setError("Points earned must be 0 or more.");
    if (
      total.trim() === "" ||
      !Number.isFinite(totalNumber) ||
      totalNumber <= 0
    )
      return setError("Points possible must be greater than 0.");
    if (!categoryId) return setError("Choose a weight category.");

    onAdd({
      name: name.trim(),
      earned: earnedNumber,
      total: totalNumber,
      categoryId,
    });
    setName("");
    setEarned("");
    setTotal("");
    setError("");
  }

  return (
    <section className="flex-1">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        Assignments
      </h3>

      <form onSubmit={handleSubmit} className="mb-2 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Assignment name"
          aria-label="Assignment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} min-w-40 flex-1`}
        />
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Earned"
            aria-label="Points earned"
            value={earned}
            onChange={(e) => setEarned(e.target.value)}
            className={`${inputClass} w-16`}
          />
          <span className="text-neutral-500">/</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Total"
            aria-label="Points possible"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={`${inputClass} w-16`}
          />
        </div>
        <select
          aria-label="Weight category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${inputClass} w-40`}
        >
          <option value="" disabled>
            Category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass}>
          Add
        </button>
      </form>
      <ErrorText message={error} />
      {categories.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500">
          Add a weight category first.
        </p>
      ) : null}

      <div className="rounded-lg border border-neutral-200">
        <div className="flex justify-between border-b border-neutral-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <span>Assignment</span>
          <span>Score</span>
        </div>
        {assignments.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">
            No assignments yet.
          </p>
        ) : (
          <ul>
            {assignments.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                categories={categories}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type WeightsPanelProps = {
  categories: Category[];
  assignments: Assignment[];
  onAdd: (category: Omit<Category, "id">) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
};

function WeightsPanel({
  categories,
  assignments,
  onAdd,
  onRemove,
  readOnly = false,
}: WeightsPanelProps) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const weightNumber = Number(weight);
    const trimmed = name.trim();

    if (!trimmed) return setError("Enter a category name.");
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase()))
      return setError("That category already exists.");
    if (
      weight.trim() === "" ||
      !Number.isFinite(weightNumber) ||
      weightNumber <= 0 ||
      weightNumber > 100
    )
      return setError("Weight must be between 0 and 100.");

    onAdd({ name: trimmed, weight: weightNumber });
    setName("");
    setWeight("");
    setError("");
  }

  return (
    <aside className={`w-full shrink-0 ${isCollapsed ? "md:w-56" : "md:w-72"}`}>
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-neutral-900">Weights</span>
        <span className="flex items-center gap-2 text-sm text-neutral-500">
          {isCollapsed ? "Show" : "Hide"}
          <span aria-hidden>{isCollapsed ? "▼" : "▲"}</span>
        </span>
      </button>

      {isCollapsed ? (
        categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No weights yet.</p>
        ) : (
          <>
            <ul className="text-sm text-neutral-900">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex justify-between gap-3 py-0.5"
                >
                  <span className="truncate">{category.name}</span>
                  <span className="shrink-0 text-neutral-500">
                    {formatPercent(category.weight)}
                  </span>
                </li>
              ))}
            </ul>
            {totalWeight !== 100 ? (
              <p className="mt-1 text-sm text-amber-600">
                Total: {formatPercent(totalWeight)}
              </p>
            ) : null}
          </>
        )
      ) : (
        <>
          {readOnly ? (
            <p className="mb-2 text-xs text-neutral-500">
              Weights are locked in what-if mode.
            </p>
          ) : (
            <>
              <form
                onSubmit={handleSubmit}
                className="mb-2 flex flex-col gap-2"
              >
                <input
                  type="text"
                  placeholder="Category name (e.g. Homework)"
                  aria-label="Category name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Weight %"
                    aria-label="Category weight percent"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button type="submit" className={buttonClass}>
                    Add
                  </button>
                </div>
              </form>
              <ErrorText message={error} />
            </>
          )}

          <div className="rounded-lg border border-neutral-200">
            <div className="flex justify-between border-b border-neutral-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <span>Category</span>
              <span>Weight</span>
            </div>
            {categories.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-neutral-500">
                No weights yet.
              </p>
            ) : (
              <ul>
                {categories.map((category) => {
                  const average = categoryAverage(category.id, assignments);
                  return (
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-neutral-900">
                          {category.name}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {average === null
                            ? "No grades"
                            : `Avg ${formatPercent(average)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-sm text-neutral-900">
                          {formatPercent(category.weight)}
                        </span>
                        {readOnly ? null : (
                          <button
                            type="button"
                            onClick={() => onRemove(category.id)}
                            aria-label={`Remove ${category.name}`}
                            title="Also removes this category's assignments"
                            className={removeClass}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {categories.length > 0 ? (
            <p
              className={`mt-2 text-sm ${
                totalWeight === 100 ? "text-neutral-500" : "text-amber-600"
              }`}
            >
              Total: {formatPercent(totalWeight)}
              {totalWeight === 100 ? "" : " (weights should add up to 100%)"}
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
}

function AddCourseForm({ onAdd }: { onAdd: (course: UserCourse) => void }) {
  const [courseNumber, setCourseNumber] = useState("");
  const [courseName, setCourseName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const number = courseNumber.trim();
    const name = courseName.trim();
    if (!number || !name) {
      setError("Enter a course number and name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      onAdd(
        await addUserCourse({
          ...emptyCourseDraft,
          courseNumber: number,
          courseName: name,
        }),
      );
      setCourseNumber("");
      setCourseName("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't save this course.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Course number"
          aria-label="Course number"
          value={courseNumber}
          onChange={(e) => setCourseNumber(e.target.value)}
          className={`${inputClass} w-36`}
        />
        <input
          type="text"
          placeholder="Course name"
          aria-label="Course name"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? "Adding" : "Add course"}
        </button>
      </div>
      <ErrorText message={error} />
    </form>
  );
}

function CourseCard({ course }: { course: GradeCourse }) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  // A throwaway copy of the assignments while what-if mode is on.
  // null means what-if mode is off, so nothing here touches the real data.
  const [whatIf, setWhatIf] = useState<Assignment[] | null>(null);

  const isWhatIf = whatIf !== null;
  const shown = whatIf ?? assignments;
  const realGrade = courseGrade(categories, assignments);
  const shownGrade = courseGrade(categories, shown);
  const difference =
    isWhatIf && realGrade !== null && shownGrade !== null
      ? shownGrade - realGrade
      : null;

  function updateShown(change: (current: Assignment[]) => Assignment[]) {
    if (isWhatIf) setWhatIf((current) => (current ? change(current) : current));
    else setAssignments(change);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span>
          <span className="text-base font-medium text-neutral-900">
            {course.courseNumber}
          </span>
          <span className="ml-2 text-sm text-neutral-500">
            {course.courseName}
          </span>
        </span>
        <span className="flex items-center gap-3 text-neutral-500">
          {shownGrade === null ? null : (
            <span className="text-sm font-medium text-neutral-900">
              {isWhatIf ? "What-if " : ""}
              {formatPercent(shownGrade)}
            </span>
          )}
          <span aria-hidden>{isOpen ? "▲" : "▼"}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-neutral-200 p-4">
          <div
            className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 ${
              isWhatIf ? "bg-blue-50" : "bg-neutral-50"
            }`}
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {isWhatIf ? "What-if grade" : "Current grade"}
              </p>
              <p className="text-2xl font-semibold text-neutral-900">
                {shownGrade === null ? "—" : formatPercent(shownGrade)}
              </p>
              {isWhatIf ? (
                <p className="text-sm text-neutral-500">
                  Original:{" "}
                  {realGrade === null ? "—" : formatPercent(realGrade)}
                  {difference === null
                    ? ""
                    : ` (${difference >= 0 ? "+" : "−"}${formatPercent(
                        Math.abs(difference),
                      )})`}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isWhatIf}
              onClick={() => setWhatIf(isWhatIf ? null : assignments)}
              className={buttonClass}
            >
              What-if mode: {isWhatIf ? "On" : "Off"}
            </button>
          </div>
          {isWhatIf ? (
            <p className="-mt-2 mb-4 text-xs text-neutral-500">
              Add or edit assignments to try out scores. Turning what-if mode
              off discards these changes.
            </p>
          ) : null}

          <div className="flex flex-col gap-6 md:flex-row">
            <AssignmentsPanel
              categories={categories}
              assignments={shown}
              onAdd={(assignment) =>
                updateShown((current) => [
                  ...current,
                  {
                    ...assignment,
                    id: crypto.randomUUID(),
                    hypothetical: isWhatIf,
                  },
                ])
              }
              onUpdate={(id, changes) =>
                updateShown((current) =>
                  current.map((a) =>
                    a.id === id
                      ? {
                          ...a,
                          ...changes,
                          ...(isWhatIf ? { hypothetical: true } : {}),
                        }
                      : a,
                  ),
                )
              }
              onRemove={(id) =>
                updateShown((current) => current.filter((a) => a.id !== id))
              }
            />
            <WeightsPanel
              categories={categories}
              assignments={shown}
              readOnly={isWhatIf}
              onAdd={(category) =>
                setCategories((current) => [
                  ...current,
                  { ...category, id: crypto.randomUUID() },
                ])
              }
              onRemove={(id) => {
                setCategories((current) => current.filter((c) => c.id !== id));
                setAssignments((current) =>
                  current.filter((a) => a.categoryId !== id),
                );
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GradeCalc({ embedded = false }: { embedded?: boolean }) {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    listUserCourses()
      .then((loaded) => {
        if (!active) return;
        setCourses(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCourses([]);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const body = (
    <>
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">
        Course Grade Calculator
      </h1>

      <div className="flex max-w-4xl flex-col gap-3">
        {status === "loading" ? (
          <p className="text-sm text-neutral-500">Loading courses…</p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-red-700">Couldn't load your courses.</p>
        ) : null}
        {status === "ready" && courses.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Add a course to start calculating grades.
          </p>
        ) : null}
        {status === "ready"
          ? courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))
          : null}
        {status === "ready" ? (
          <AddCourseForm
            onAdd={(course) => setCourses((current) => [...current, course])}
          />
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return <div className="mt-6">{body}</div>;
  }

  return <main className="flex-1 bg-white px-6 py-6">{body}</main>;
}
