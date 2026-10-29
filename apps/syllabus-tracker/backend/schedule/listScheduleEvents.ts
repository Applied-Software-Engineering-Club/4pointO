"use server";

import { createClient } from "@/utils/supabase/server";
import { scheduleEventFromRow, type ScheduleEvent } from "./scheduleEvent";

export async function listScheduleEvents(): Promise<ScheduleEvent[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("syllabus-schedule-events")
    .select("id, title, day, start_minute, end_minute, color")
    .eq("user_id", auth.user.id)
    .order("day")
    .order("start_minute");

  if (error || !Array.isArray(data)) {
    throw new Error("Couldn't load your schedule.");
  }

  return data.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const event = scheduleEventFromRow(row as Record<string, unknown>);
    return event ? [event] : [];
  });
}
