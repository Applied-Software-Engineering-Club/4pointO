export const scheduleColors = [
  { name: "Blue", value: "#1d4ed8" },
  { name: "Green", value: "#047857" },
  { name: "Amber", value: "#b45309" },
  { name: "Purple", value: "#6d28d9" },
  { name: "Rose", value: "#be123c" },
  { name: "Teal", value: "#0f766e" },
] as const;

const earliestMinute = 8 * 60;
const latestMinute = 21 * 60;

export type ScheduleEvent = {
  id: string;
  title: string;
  day: number;
  start: number;
  end: number;
  color: string;
};

export type ScheduleEventInput = Omit<ScheduleEvent, "id">;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function scheduleEventInput(value: ScheduleEventInput): ScheduleEventInput {
  const title = value.title.trim() || "Untitled";
  const color = scheduleColors.some((item) => item.value === value.color)
    ? value.color
    : "";

  if (
    title.length > 80 ||
    !Number.isInteger(value.day) ||
    value.day < 0 ||
    value.day > 6 ||
    !Number.isInteger(value.start) ||
    value.start < earliestMinute ||
    value.start > latestMinute - 15 ||
    !Number.isInteger(value.end) ||
    value.end <= value.start ||
    value.end > latestMinute ||
    !color
  ) {
    throw new Error("Couldn't save this event.");
  }

  return {
    title,
    day: value.day,
    start: value.start,
    end: value.end,
    color,
  };
}

export function scheduleEventFromRow(row: Record<string, unknown>): ScheduleEvent | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!isUuid(id)) {
    return null;
  }

  try {
    return {
      id,
      ...scheduleEventInput({
        title: typeof row.title === "string" ? row.title : "",
        day: Number(row.day),
        start: Number(row.start_minute),
        end: Number(row.end_minute),
        color: typeof row.color === "string" ? row.color : "",
      }),
    };
  } catch {
    return null;
  }
}

export function scheduleEventId(id: string, message = "Couldn't save this event.") {
  const trimmed = id.trim();
  if (!isUuid(trimmed)) {
    throw new Error(message);
  }

  return trimmed;
}
