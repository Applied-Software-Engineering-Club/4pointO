"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  addTodoItem,
  deleteTodoItem,
  listTodoItems,
  updateTodoItem,
  type TodoItem,
} from "@/apps/syllabus-tracker/backend/todo";
import { listUserCourses } from "@/apps/syllabus-tracker/backend/courses/listUserCourses";
import type { UserCourse } from "@/apps/syllabus-tracker/backend/courses/userCourse";

function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function byDueDate(a: TodoItem, b: TodoItem) {
  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate) {
    return -1;
  }
  if (b.dueDate) {
    return 1;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

const fieldClassName =
  "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-400";

export function TodoList() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [courseId, setCourseId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([listTodoItems(), listUserCourses()])
      .then(([loadedItems, loadedCourses]) => {
        if (!active) {
          return;
        }
        setItems(loadedItems);
        setCourses(loadedCourses);
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function courseLabel(id: string | null) {
    if (!id) {
      return "";
    }
    return courses.find((course) => course.id === id)?.courseNumber ?? "";
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) {
      return;
    }
    setAdding(true);
    setError(null);

    try {
      const saved = await addTodoItem({
        title,
        dueDate: dueDate || null,
        courseId: courseId || null,
      });
      setItems((current) => [...current, saved]);
      setTitle("");
      setDueDate("");
      setCourseId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this assignment.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleItem(item: TodoItem) {
    setBusyId(item.id);
    setError(null);

    try {
      const saved = await updateTodoItem(item.id, {
        title: item.title,
        dueDate: item.dueDate,
        completed: !item.completed,
        courseId: item.courseId,
      });
      setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this assignment.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item: TodoItem) {
    setBusyId(item.id);
    setError(null);

    try {
      await deleteTodoItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't remove this assignment.");
    } finally {
      setBusyId(null);
    }
  }

  const today = todayString();
  const sorted = [...items].sort(byDueDate);
  const overdue = sorted.filter((item) => !item.completed && item.dueDate !== null && item.dueDate < today);
  const upcoming = sorted.filter((item) => !item.completed && !(item.dueDate !== null && item.dueDate < today));
  const completed = sorted.filter((item) => item.completed);

  const groups = [
    { name: "Overdue", items: overdue },
    { name: "Upcoming", items: upcoming },
    { name: "Completed", items: completed },
  ];

  return (
    <section aria-label="Assignments" className="mt-10 max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-900">Assignments</h2>

      {status === "loading" ? (
        <p className="mt-4 text-sm text-neutral-500">Loading assignments…</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-4 text-sm text-red-700">{"Couldn't load your assignments."}</p>
      ) : null}

      {status === "ready" ? (
        <>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">No assignments yet. Add one below.</p>
          ) : (
            groups.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.name} className="mt-5">
                  <h3
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      group.name === "Overdue" ? "text-red-700" : "text-neutral-500"
                    }`}
                  >
                    {group.name} · {group.items.length}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {group.items.map((item) => {
                      const course = courseLabel(item.courseId);
                      const late = group.name === "Overdue";

                      return (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                        >
                          <input
                            id={`todo-${item.id}`}
                            type="checkbox"
                            checked={item.completed}
                            disabled={busyId === item.id}
                            onChange={() => void toggleItem(item)}
                            className="size-4 shrink-0 accent-neutral-900"
                          />
                          <label
                            htmlFor={`todo-${item.id}`}
                            className={`min-w-0 flex-1 text-sm ${
                              item.completed ? "text-neutral-400 line-through" : "text-neutral-900"
                            }`}
                          >
                            {item.title}
                            {course ? (
                              <span className="ml-2 text-xs text-neutral-500">{course}</span>
                            ) : null}
                          </label>
                          {item.dueDate ? (
                            <span
                              className={`shrink-0 text-xs ${
                                late ? "font-medium text-red-700" : "text-neutral-500"
                              }`}
                            >
                              {formatDate(item.dueDate)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => void removeItem(item)}
                            disabled={busyId === item.id}
                            className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none text-neutral-400 hover:text-red-700 disabled:opacity-50"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )
          )}

          <form
            onSubmit={addItem}
            noValidate
            className="mt-6 grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
          >
            <label className="text-xs font-medium text-neutral-500">
              Assignment
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="HW 3"
                className={fieldClassName}
              />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Course
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                className={fieldClassName}
              >
                <option value="">None</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseNumber}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {adding ? "Adding" : "Add"}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </>
      ) : null}
    </section>
  );
}