"use server";

import { createClient } from "@/utils/supabase/server";
import {
  SAVE_ERROR_MESSAGE,
  assertCourseOwned,
  isTodoRow,
  todoItemColumns,
  todoItemFromRow,
  todoItemId,
  todoItemInput,
  type TodoItem,
  type TodoItemInput,
} from "./todoItem";

export async function updateTodoItem(
  id: string,
  input: TodoItemInput,
): Promise<TodoItem> {
  const itemId = todoItemId(id);
  const item = todoItemInput(input);
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  await assertCourseOwned(supabase, user.id, item.courseId);

  const { data, error: updateError } = await supabase
    .from("syllabus-todo-items")
    .update({
      title: item.title,
      due_date: item.dueDate,
      completed: item.completed,
      course_id: item.courseId,
    })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select(todoItemColumns)
    .single();

  const saved = isTodoRow(data) ? todoItemFromRow(data) : null;
  if (updateError || !saved) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  return saved;
}
