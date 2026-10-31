import type { SupabaseClient } from "@supabase/supabase-js";

export const todoItemColumns =
  "id, title, due_date, completed, course_id, created_at";

export const SAVE_ERROR_MESSAGE = "Couldn't save this assignment.";
export const LOAD_ERROR_MESSAGE = "Couldn't load your assignments.";
export const REMOVE_ERROR_MESSAGE = "Couldn't remove this assignment.";

export type TodoItem = {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  courseId: string | null;
  createdAt: string;
};

export type TodoItemInput = {
  title: string;
  dueDate?: string | null;
  completed?: boolean;
  courseId?: string | null;
};

export type ValidatedTodoItemInput = {
  title: string;
  dueDate: string | null;
  completed: boolean;
  courseId: string | null;
};

export function isTodoRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function dueDate(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  return trimmed;
}

function optionalCourseId(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!isUuid(trimmed)) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  return trimmed;
}

export function todoItemInput(value: TodoItemInput): ValidatedTodoItemInput {
  const title = value.title.trim();
  if (!title || title.length > 200) {
    throw new Error(
      title ? SAVE_ERROR_MESSAGE : "Enter an assignment title.",
    );
  }

  return {
    title,
    dueDate: dueDate(value.dueDate),
    completed: value.completed === true,
    courseId: optionalCourseId(value.courseId),
  };
}

export function todoItemFromRow(row: Record<string, unknown>): TodoItem | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!isUuid(id)) {
    return null;
  }

  try {
    const input = todoItemInput({
      title: typeof row.title === "string" ? row.title : "",
      dueDate: typeof row.due_date === "string" ? row.due_date : null,
      completed: row.completed === true,
      courseId: typeof row.course_id === "string" ? row.course_id : null,
    });
    const createdAt = typeof row.created_at === "string" ? row.created_at : "";

    if (!createdAt) {
      return null;
    }

    return {
      id,
      title: input.title,
      dueDate: input.dueDate,
      completed: input.completed,
      courseId: input.courseId,
      createdAt,
    };
  } catch {
    return null;
  }
}

export function todoItemId(id: string, message = SAVE_ERROR_MESSAGE) {
  const trimmed = id.trim();
  if (!isUuid(trimmed)) {
    throw new Error(message);
  }

  return trimmed;
}

export async function assertCourseOwned(
  supabase: SupabaseClient,
  userId: string,
  courseId: string | null,
) {
  if (!courseId) {
    return;
  }

  const { data: course, error } = await supabase
    .from("user-courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !course) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }
}
