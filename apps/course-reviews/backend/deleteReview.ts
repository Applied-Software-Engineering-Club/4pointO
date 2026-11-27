"use server";

import { createClient } from "@/utils/supabase/server";

function reviewId(id: string) {
  const trimmed = id.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("Could not remove this review.");
  }

  return trimmed;
}

export async function deleteReview(id: string): Promise<void> {
  const idValue = reviewId(id);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Could not remove this review.");
  }

  // Ownership stays in the delete policy. user_id is not readable by students.
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", idValue)
    .select("id");

  if (error || !data?.length) {
    throw new Error("Could not remove this review.");
  }
}
