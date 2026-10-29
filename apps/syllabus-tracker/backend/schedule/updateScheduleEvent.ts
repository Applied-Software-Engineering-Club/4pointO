"use server";

import { createClient } from "@/utils/supabase/server";
import {
  scheduleEventFromRow,
  scheduleEventId,
  scheduleEventInput,
  type ScheduleEvent,
} from "./scheduleEvent";

export async function updateScheduleEvent(event: ScheduleEvent): Promise<ScheduleEvent> {
  const id = scheduleEventId(event.id);
  const input = scheduleEventInput(event);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save this event.");
  }

  const { data, error } = await supabase
    .from("syllabus-schedule-events")
    .update({
      title: input.title,
      day: input.day,
      start_minute: input.start,
      end_minute: input.end,
      color: input.color,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id, title, day, start_minute, end_minute, color")
    .single();

  const saved =
    data && typeof data === "object" ? scheduleEventFromRow(data) : null;
  if (error || !saved) {
    throw new Error("Couldn't save this event.");
  }

  return saved;
}
