"use server";

import { createClient } from "@/utils/supabase/server";
import {
  scheduleEventFromRow,
  scheduleEventInput,
  type ScheduleEvent,
  type ScheduleEventInput,
} from "./scheduleEvent";

export async function addScheduleEvent(
  input: ScheduleEventInput,
): Promise<ScheduleEvent> {
  const event = scheduleEventInput(input);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    throw new Error("Couldn't save this event.");
  }

  const { data, error } = await supabase
    .from("syllabus-schedule-events")
    .insert({
      user_id: auth.user.id,
      title: event.title,
      day: event.day,
      start_minute: event.start,
      end_minute: event.end,
      color: event.color,
    })
    .select("id, title, day, start_minute, end_minute, color")
    .single();

  const saved =
    data && typeof data === "object" ? scheduleEventFromRow(data) : null;
  if (error || !saved) {
    throw new Error("Couldn't save this event.");
  }

  return saved;
}
