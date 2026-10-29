"use server";

import { createClient } from "@/utils/supabase/server";

function courseId(id: string) {
  const trimmed = id.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("Couldn't remove this course.");
  }

  return trimmed;
}

export async function deleteUserCourse(id: string): Promise<void> {
  const courseIdValue = courseId(id);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't remove this course.");
  }

  const { data, error } = await supabase
    .from("user-courses")
    .delete()
    .eq("id", courseIdValue)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("Couldn't remove this course.");
  }
}
