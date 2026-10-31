"use server";

import { createClient } from "@/utils/supabase/server";
import {
  LOAD_ERROR_MESSAGE,
  isTodoRow,
  todoItemColumns,
  todoItemFromRow,
  type TodoItem,
} from "./todoItem";

export async function listTodoItems(): Promise<TodoItem[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("syllabus-todo-items")
    .select(todoItemColumns)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at");

  if (error || !Array.isArray(data)) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  return data.flatMap((row) => {
    if (!isTodoRow(row)) {
      return [];
    }

    const item = todoItemFromRow(row);
    return item ? [item] : [];
  });
}
