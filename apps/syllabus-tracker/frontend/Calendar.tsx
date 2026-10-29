"use client";

import { enUS } from "date-fns/locale/en-US";
import { format, getDay, parse, startOfWeek } from "date-fns";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type HeaderProps,
  type SlotInfo,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { addScheduleEvent } from "@/apps/syllabus-tracker/backend/schedule/addScheduleEvent";
import { deleteScheduleEvent } from "@/apps/syllabus-tracker/backend/schedule/deleteScheduleEvent";
import { listScheduleEvents } from "@/apps/syllabus-tracker/backend/schedule/listScheduleEvents";
import {
  scheduleColors,
  type ScheduleEvent,
} from "@/apps/syllabus-tracker/backend/schedule/scheduleEvent";
import { updateScheduleEvent } from "@/apps/syllabus-tracker/backend/schedule/updateScheduleEvent";
import "./calendar.css";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const startHour = 8;
const endHour = 21;
const snapMinutes = 15;
const defaultDuration = 60;
const scheduleStart = startHour * 60;
const scheduleEnd = endHour * 60;
const fixedWeekStart = new Date(2026, 0, 4);
const dayStart = new Date(2026, 0, 4, startHour, 0, 0);
const dayEnd = new Date(2026, 0, 4, endHour, 0, 0);
const colors = scheduleColors;
const timeOptions = Array.from(
  { length: (scheduleEnd - scheduleStart) / snapMinutes },
  (_, index) => scheduleStart + index * snapMinutes,
);

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
};

type EditorState = ScheduleEvent & {
  session: number;
  top: number;
  left: number;
};

type StoredRange = {
  day: number;
  start: number;
  end: number;
};

const ScheduleCalendar = withDragAndDrop<CalendarEvent>(BigCalendar);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(minutes: number) {
  return Math.round(minutes / snapMinutes) * snapMinutes;
}

function formatTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute.toString().padStart(2, "0")} ${period}`;
}

function nextColor(count: number) {
  return colors[count % colors.length].value;
}

function dateFromMinutes(day: number, minutes: number) {
  const date = new Date(fixedWeekStart);
  date.setDate(fixedWeekStart.getDate() + day);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function toCalendarEvent(event: ScheduleEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    color: event.color,
    start: dateFromMinutes(event.day, event.start),
    end: dateFromMinutes(event.day, event.end),
  };
}

function toStoredRange(startDate: Date, endDate: Date): StoredRange | null {
  const start = new Date(Math.min(startDate.getTime(), endDate.getTime()));
  const end = new Date(Math.max(startDate.getTime(), endDate.getTime()));
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const startMinutes = clamp(
    snap(start.getHours() * 60 + start.getMinutes()),
    scheduleStart,
    scheduleEnd - snapMinutes,
  );
  const rawEnd = sameDay ? end.getHours() * 60 + end.getMinutes() : scheduleEnd;
  const endMinutes = clamp(snap(rawEnd), startMinutes + snapMinutes, scheduleEnd);

  if (endMinutes <= startMinutes) {
    return null;
  }

  return { day: start.getDay(), start: startMinutes, end: endMinutes };
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function placePopover(clientX: number, clientY: number) {
  const width = 288;
  const height = 292;
  return {
    left: clamp(clientX + 8, 12, window.innerWidth - width - 12),
    top: clamp(clientY - 8, 12, window.innerHeight - height - 12),
  };
}

function withValidRange<T extends StoredRange>(range: T, patch: Partial<StoredRange>) {
  const next = { ...range, ...patch };
  if (next.end <= next.start) {
    if (patch.end !== undefined) {
      next.start = Math.max(scheduleStart, next.end - snapMinutes);
    } else {
      next.end = Math.min(scheduleEnd, next.start + snapMinutes);
    }
  }
  return next;
}

function WeekdayHeader({ date }: HeaderProps) {
  return <span>{weekdayLabels[date.getDay()]}</span>;
}

export function Calendar() {
  const [events, setEvents] = useState<ScheduleEvent[] | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    let active = true;

    listScheduleEvents()
      .then((loaded) => {
        if (active) {
          setEvents(loaded);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setEvents([]);
        setLoadError("Couldn't load your schedule.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    titleRef.current?.focus();
  }, [editor?.session]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEditor(null);
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || popoverRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest(".weekly-schedule")) {
        return;
      }

      setEditor(null);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [editor]);

  function openEditor(range: StoredRange, point: { top: number; left: number }, existing?: ScheduleEvent) {
    setSaveError(null);
    setEditor({
      session: Date.now(),
      id: existing?.id ?? "",
      title: existing?.title ?? "",
      color: existing?.color ?? nextColor(events?.length ?? 0),
      day: range.day,
      start: range.start,
      end: range.end,
      top: point.top,
      left: point.left,
    });
  }

  function updateEditor(patch: Partial<StoredRange & { title: string; color: string }>) {
    setEditor((current) => (current ? withValidRange(current, patch) : current));
  }

  function onSelectSlot(slot: SlotInfo) {
    const start = new Date(slot.start);
    const end =
      slot.action === "click"
        ? new Date(start.getTime() + defaultDuration * 60 * 1000)
        : new Date(slot.end);
    const range = toStoredRange(start, end);
    if (!range) {
      return;
    }

    const point = slot.bounds
      ? placePopover(slot.bounds.x, slot.bounds.y)
      : slot.box
        ? placePopover(slot.box.clientX, slot.box.clientY)
        : { top: 96, left: 96 };
    openEditor(range, point);
  }

  function onSelectEvent(event: CalendarEvent, nativeEvent: SyntheticEvent<HTMLElement>) {
    if (event.id === "draft" || events === null) {
      return;
    }

    const stored = events.find((item) => item.id === event.id);
    if (!stored) {
      return;
    }

    const mouse = nativeEvent.nativeEvent;
    const point =
      "clientX" in mouse && "clientY" in mouse
        ? placePopover(Number(mouse.clientX), Number(mouse.clientY))
        : { top: 96, left: 96 };
    openEditor({ day: stored.day, start: stored.start, end: stored.end }, point, stored);
  }

  function moveEvent({ event, start, end }: EventInteractionArgs<CalendarEvent>) {
    const range = toStoredRange(asDate(start), asDate(end));
    if (!range || event.id === "draft") {
      if (range && event.id === "draft") {
        setEditor((current) => (current ? { ...current, ...range } : current));
      }
      return;
    }

    const previous = (events ?? []).find((item) => item.id === event.id);
    if (!previous) {
      return;
    }

    const next = { ...previous, ...range };
    setEvents((current) =>
      (current ?? []).map((item) => (item.id === event.id ? next : item)),
    );
    setEditor((current) => (current?.id === event.id ? { ...current, ...range } : current));
    updateScheduleEvent(next).catch(() => {
      setEvents((current) =>
        (current ?? []).map((item) => (item.id === previous.id ? previous : item)),
      );
      setLoadError("Couldn't save this event.");
    });
  }

  function onAddClick(event: ReactMouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    openEditor(
      { day: 1, start: 9 * 60, end: 10 * 60 },
      placePopover(rect.left, rect.bottom),
    );
  }

  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || savingRef.current) {
      return;
    }

    const input = {
      title: editor.title.trim() || "Untitled",
      day: editor.day,
      start: editor.start,
      end: editor.end,
      color: editor.color,
    };
    const editorId = editor.id;
    savingRef.current = true;
    setSaveError(null);

    try {
      const saved = editorId
        ? await updateScheduleEvent({ id: editorId, ...input })
        : await addScheduleEvent(input);
      setEvents((current) => {
        const list = current ?? [];
        return editorId
          ? list.map((item) => (item.id === saved.id ? saved : item))
          : [...list, saved];
      });
      setEditor(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save this event.");
    } finally {
      savingRef.current = false;
    }
  }

  async function deleteEditor() {
    if (!editor?.id) {
      setEditor(null);
      return;
    }

    if (savingRef.current) {
      return;
    }

    const eventId = editor.id;
    savingRef.current = true;
    setSaveError(null);

    try {
      await deleteScheduleEvent(eventId);
      setEvents((current) => (current ?? []).filter((item) => item.id !== eventId));
      setEditor(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't remove this event.");
    } finally {
      savingRef.current = false;
    }
  }

  const calendarEvents = useMemo(() => {
    const saved = (events ?? []).filter((item) => item.id !== editor?.id).map(toCalendarEvent);
    if (!editor) {
      return saved;
    }

    saved.push(
      toCalendarEvent({
        id: editor.id || "draft",
        title: editor.title.trim() || "Untitled",
        day: editor.day,
        start: editor.start,
        end: editor.end,
        color: editor.color,
      }),
    );
    return saved;
  }, [editor, events]);

  return (
    <section aria-label="Weekly schedule" className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Weekly schedule</h2>
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
        >
          Add event
        </button>
      </div>
      {loadError ? <p className="-mt-2 mb-4 text-sm text-red-700">{loadError}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 shadow-sm">
        <ScheduleCalendar
          className="weekly-schedule"
          localizer={localizer}
          culture="en-US"
          events={calendarEvents}
          date={fixedWeekStart}
          view="week"
          views={["week"]}
          toolbar={false}
          drilldownView={null}
          selectable="ignoreEvents"
          resizable
          step={15}
          timeslots={4}
          min={dayStart}
          max={dayEnd}
          allDayAccessor={() => false}
          allDayMaxRows={0}
          style={{ height: 780 }}
          components={{ header: WeekdayHeader }}
          formats={{ timeGutterFormat: "h a" }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.color,
              border: "none",
              borderRadius: 6,
              color: "#fff",
            },
          })}
          onNavigate={() => undefined}
          onView={() => undefined}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
        />
      </div>
      {editor ? (
        <form
          ref={popoverRef}
          role="dialog"
          aria-labelledby={titleId}
          onSubmit={saveEditor}
          className="fixed z-40 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
          style={{ top: editor.top, left: editor.left }}
        >
          <h3 id={titleId} className="sr-only">
            {editor.id ? "Edit event" : "Add event"}
          </h3>
          <input
            ref={titleRef}
            value={editor.title}
            onChange={(event) => updateEditor({ title: event.target.value })}
            placeholder="Add title"
            aria-label="Title"
            autoComplete="off"
            className="w-full border-b border-neutral-200 pb-2 text-base font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <div className="mt-3 grid gap-2">
            <select
              aria-label="Day"
              value={editor.day}
              onChange={(event) => updateEditor({ day: Number(event.target.value) })}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              {weekdayNames.map((name, day) => (
                <option key={name} value={day}>
                  {name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <select
                aria-label="Start time"
                value={editor.start}
                onChange={(event) => updateEditor({ start: Number(event.target.value) })}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                {timeOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatTime(minutes)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-400">to</span>
              <select
                aria-label="End time"
                value={editor.end}
                onChange={(event) => updateEditor({ end: Number(event.target.value) })}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                {[...timeOptions.filter((minutes) => minutes > editor.start), scheduleEnd].map(
                  (minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatTime(minutes)}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Color">
              {colors.map((color) => {
                const selected = editor.color === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={color.name}
                    onClick={() => updateEditor({ color: color.value })}
                    className={
                      selected
                        ? "h-6 w-6 rounded-full ring-2 ring-neutral-900 ring-offset-2"
                        : "h-6 w-6 rounded-full"
                    }
                    style={{ backgroundColor: color.value }}
                  />
                );
              })}
            </div>
          </div>
          {saveError ? <p className="mt-3 text-sm text-red-700">{saveError}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            {editor.id ? (
              <button
                type="button"
                onClick={deleteEditor}
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
