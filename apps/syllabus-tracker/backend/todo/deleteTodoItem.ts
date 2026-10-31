"use server";

import { createClient } from "@/utils/supabase/server";
import { REMOVE_ERROR_MESSAGE, todoItemId } from "./todoItem";

export async function deleteTodoItem(id: string): Promise<void> {
  const itemId = todoItemId(id, REMOVE_ERROR_MESSAGE);
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(REMOVE_ERROR_MESSAGE);
  }

  const { data, error } = await supabase
    .from("syllabus-todo-items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error(REMOVE_ERROR_MESSAGE);
  }
}
