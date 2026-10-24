"use server";

import { createClient } from "@/utils/supabase/server";

export async function deleteUserCourse(id: string): Promise<void> {
  const courseId = id.trim();
  if (!courseId) {
    throw new Error("Couldn't remove this course.");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't remove this course.");
  }

  const { data, error } = await supabase
    .from("gpa-calc-user-courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("Couldn't remove this course.");
  }
}
