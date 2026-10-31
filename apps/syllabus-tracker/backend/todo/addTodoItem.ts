"use server";

import { createClient } from "@/utils/supabase/server";
import {
  SAVE_ERROR_MESSAGE,
  assertCourseOwned,
  isTodoRow,
  todoItemColumns,
  todoItemFromRow,
  todoItemInput,
  type TodoItem,
  type TodoItemInput,
} from "./todoItem";

export async function addTodoItem(input: TodoItemInput): Promise<TodoItem> {
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

  const { data, error: insertError } = await supabase
    .from("syllabus-todo-items")
    .insert({
      user_id: user.id,
      title: item.title,
      due_date: item.dueDate,
      completed: item.completed,
      course_id: item.courseId,
    })
    .select(todoItemColumns)
    .single();

  const saved = isTodoRow(data) ? todoItemFromRow(data) : null;
  if (insertError || !saved) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  return saved;
}
