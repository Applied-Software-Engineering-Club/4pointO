"use server";

import { createClient } from "@/utils/supabase/server";
import { scheduleEventId } from "./scheduleEvent";

export async function deleteScheduleEvent(id: string): Promise<void> {
  const eventId = scheduleEventId(id, "Couldn't remove this event.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't remove this event.");
  }

  const { data, error } = await supabase
    .from("syllabus-schedule-events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("Couldn't remove this event.");
  }
}
