"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { emptyDashboard, type DashboardData } from "./model";
import { Icon, type IconName } from "./Icon";
import { FocusTimer } from "./FocusTimer";
import { useLocalPreference } from "./useLocalPreference";

const widgets = { next: "Up next", gpa: "GPA snapshot", degree: "Degree planning", assignments: "Assignments", calendar: "Calendar", notes: "Personal notes", courses: "Semester courses", focus: "Study focus" } as const;
type WidgetId = keyof typeof widgets;
const defaultHidden: WidgetId[] = [];
const isHidden = (value: unknown): value is WidgetId[] => Array.isArray(value) && value.every((item) => typeof item === "string" && item in widgets);
const isString = (value: unknown): value is string => typeof value === "string";
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const defaultIds: string[] = [];
const defaultNote = "“Start with the hard thing.\nThen get a really good coffee.”";
const columns: WidgetId[][] = [["next", "gpa", "degree"], ["assignments", "calendar"], ["notes", "courses", "focus"]];
function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="card-link">{children}<Icon name="arrow" /></Link>;
}
function clock(minutes: number) { return format(new Date(2026, 0, 1, Math.floor(minutes / 60), minutes % 60), "h:mm a"); }
function Empty({ children, href, action }: { children: ReactNode; href?: string; action?: string }) {
  return <div className="empty-state"><p>{children}</p>{href ? <ArrowLink href={href}>{action ?? "Get started"}</ArrowLink> : null}</div>;
}

export function Dashboard({ data, preview, view }: { data: DashboardData; preview: boolean; view: "overview" | "academic" | "personal" }) {
  const namespace = `4pointo.${preview ? "demo" : "personal"}.v1`;
  const [hidden, setHidden] = useLocalPreference(`${namespace}.hidden`, defaultHidden, isHidden);
  const [note, setNote] = useLocalPreference(`${namespace}.note`, preview ? defaultNote : "", isString);
  const [completedIds, setCompletedIds] = useLocalPreference(`${namespace}.completed`, defaultIds, isIds);
  const [empty, setEmpty] = useState(false);
  const [completedView, setCompletedView] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [selectedDay, setSelectedDay] = useState((parseISO(data.date).getDay() + 6) % 7);
  const [noteSaved, setNoteSaved] = useState(false);
  const customizeRef = useRef<HTMLDialogElement>(null);
  const customizeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [storageStatus, setStorageStatus] = useState("");
  const shown = empty ? emptyDashboard(data.date) : data;
  const assignments = shown.assignments.map((task) => ({ ...task, completed: preview && completedIds.includes(task.id) ? !task.completed : task.completed }));
  const upcoming = assignments.filter((task) => !task.completed);
  const completed = assignments.filter((task) => task.completed);
  const todayTasks = upcoming.filter((task) => task.dueDate?.slice(0, 10) === data.date).length;
  const todayClasses = shown.events.filter((event) => event.day === (parseISO(data.date).getDay() + 6) % 7 && event.kind === "class").length;
  const weekStart = startOfWeek(parseISO(data.date), { weekStartsOn: 1 });
  const selectedDate = addDays(weekStart, selectedDay);
  const todayEvents = shown.events.filter((event) => event.day === selectedDay).sort((a, b) => a.start - b.start);
  function openCustomize(trigger: HTMLButtonElement) {
    customizeTriggerRef.current = trigger;
    customizeRef.current?.showModal();
  }
  function canShow(id: WidgetId) {
    if (studyMode) return id === "focus" || id === "assignments";
    if (hidden.includes(id)) return false;
    if (view === "academic") return id !== "notes" && id !== "focus";
    if (view === "personal") return id === "notes" || id === "focus" || id === "calendar";
    return true;
  }
  function focusWidget(id: WidgetId) {
    if (id === "focus") setStudyMode(true);
    if (hidden.includes(id)) setHidden(hidden.filter((item) => item !== id));
    // Give React time to reveal a hidden widget before moving keyboard focus.
    window.setTimeout(() => { const element = document.getElementById(`widget-${id}`); element?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" }); element?.focus({ preventScroll: true }); }, 50);
  }
  function saveNote(value: string) {
    setNote(value); setNoteSaved(true);
    try { setStorageStatus(window.localStorage.getItem(`${namespace}.note`) ? "Saved on this device" : "Saved for this visit only"); }
    catch { setStorageStatus("Saved for this visit only · Device storage unavailable"); }
  }
  const content: Record<WidgetId, ReactNode> = {
    next: <>
      <div className="card-heading"><span className="next-badge">{shown.nextClass?.status ?? "Your next class"}</span><Link href="/syllabus-tracker" className="icon-button" aria-label="Open courses"><Icon name="arrow" /></Link></div>
      {shown.nextClass ? <><h2 className="next-title">{shown.nextClass.title}</h2><p className="next-course">{shown.nextClass.code} <span>·</span> {shown.nextClass.professor}</p><div className="next-bottom"><div><p className="class-time">{shown.nextClass.time}</p><p className="class-room">{shown.nextClass.location}</p></div><Link href="/syllabus-tracker" className="class-open" aria-label="View next class"><Icon name="arrow" /></Link></div></> : <Empty href="/syllabus-tracker" action="Open your courses">Your next class will feel right at home here. Add your schedule in the course tools.</Empty>}
    </>,
    gpa: <>
      <div className="card-heading"><h2>Your academic snapshot</h2><ArrowLink href="/gpa-calc">GPA</ArrowLink></div>
      {shown.semesterGpa === null && shown.cumulativeGpa === null ? <Empty href="/gpa-calc" action="Open GPA calculator">A fresh start. Add your courses and grades to see your GPA.</Empty> : <><div className="gpa-metric"><span className="gpa-number">{shown.semesterGpa?.toFixed(2) ?? "—"}</span><div><strong>Semester GPA</strong><span>{shown.term} · 4.00 scale</span></div></div><p className="gpa-secondary">Cumulative GPA <strong>{shown.cumulativeGpa?.toFixed(2) ?? "Not available"}</strong>{preview && <span> · Sample data</span>}</p><Link href="/gpa-calc" className="what-if">What could your next A change?<Icon name="arrow" /></Link></>}
    </>,
    degree: <>
      <div className="card-heading"><h2>Your next chapter</h2><Icon name="degree" /></div>
      {shown.degree ? <><div className="degree-line"><span>{shown.degree.label}</span><strong>{shown.degree.completed} / {shown.degree.total} cr</strong></div><div className="degree-progress" role="progressbar" aria-label="Sample degree credits completed" aria-valuemin={0} aria-valuemax={shown.degree.total} aria-valuenow={shown.degree.completed}><span style={{ width: `${shown.degree.completed / shown.degree.total * 100}%` }} /></div><p className="metadata">Sample degree progress · Demo only</p></> : <Empty>Degree planning is still ahead. Verified degree requirements are needed to show your progress.</Empty>}
    </>,
    assignments: <>
      <div className="card-heading"><h2>A little closer to done</h2><ArrowLink href="/syllabus-tracker">All assignments</ArrowLink></div>
      <div className="assignment-tabs" aria-label="Assignment view"><button aria-pressed={!completedView} onClick={() => setCompletedView(false)}>Upcoming <span>{upcoming.length}</span></button><button aria-pressed={completedView} onClick={() => setCompletedView(true)}>Completed <span>{completed.length}</span></button></div>
      {(completedView ? completed : upcoming).length ? <ul className="assignment-list">{(completedView ? completed : upcoming).slice(0, 4).map((task) => <li key={task.id} className={task.completed ? "task-complete" : ""}>
        {preview ? <input type="checkbox" checked={task.completed} aria-label={`Mark ${task.title} ${task.completed ? "upcoming" : "complete"}`} onChange={() => setCompletedIds(completedIds.includes(task.id) ? completedIds.filter((id) => id !== task.id) : [...completedIds, task.id])} /> : <span className="task-status-icon" aria-hidden="true">{task.completed ? "✓" : "○"}</span>}
        <div className="task-copy"><p>{task.title}</p><span>{task.course} · {task.dueDate ? format(parseISO(task.dueDate), "EEE, MMM d · h:mm a") : "No due date"}</span></div><span className={`status-chip ${task.completed ? "done" : ""}`}>{task.completed ? "Done" : "Upcoming"}</span>
      </li>)}</ul> : <Empty>{completedView ? "Completed work will appear here. One thing at a time." : "A little breathing room. No upcoming assignments."}</Empty>}
      <p className="metadata assignment-footer">{preview ? "Sample assignments · Check off to try it locally" : "Manage completion in the syllabus tracker"}</p>
    </>,
    calendar: <>
      <div className="card-heading"><h2>Life, on one calendar</h2><ArrowLink href="/syllabus-tracker?tab=calendar">{format(selectedDate, "MMMM yyyy")}</ArrowLink></div>
      <div className="week-days" aria-label="Choose a day">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <button key={day} aria-pressed={selectedDay === index} aria-label={format(addDays(weekStart, index), "EEEE, MMMM d, yyyy")} onClick={() => setSelectedDay(index)}>{day}</button>)}</div>
      <p className="sr-only">Schedule for {format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
      {todayEvents.length ? <ol className="calendar-events">{todayEvents.slice(0, 5).map((event) => <li key={event.id}><time>{clock(event.start)}</time><span className={`event-block event-${event.kind}`}><span>{event.title}</span><span className="event-duration">{clock(event.end)}</span></span></li>)}</ol> : <Empty>Nothing scheduled for {format(selectedDate, "EEEE")}. Room for whatever matters.</Empty>}
      <div className="calendar-key"><span><i className="key-class" />Classes</span><span><i className="key-study" />Study</span><span><i className="key-personal" />Personal</span></div>
    </>,
    notes: <>
      <div className="card-heading"><h2>A thought worth keeping</h2><label htmlFor="personal-note" className="note-edit">Edit note<Icon name="note" /></label></div>
      <textarea id="personal-note" aria-label="Personal note" placeholder="A reminder, a small idea, a little encouragement…" maxLength={2000} value={empty ? "" : note} onChange={(event) => { if (empty) setEmpty(false); saveNote(event.target.value); }} />
      <p className="note-helper">A small space for what’s on your mind.</p><p className="metadata" role="status">{noteSaved ? storageStatus : "Saved on this device"}{preview ? " · Demo note" : ""}</p>
    </>,
    courses: <>
      <div className="card-heading"><h2>This semester</h2><ArrowLink href="/syllabus-tracker">Courses</ArrowLink></div>
      {shown.courses.length ? <ul className="semester-courses">{shown.courses.slice(0, 6).map((course) => <li key={course.id}><Link href="/gpa-calc"><strong>{course.code}</strong><span>{course.title}</span><b>{course.grade}</b></Link></li>)}</ul> : <Empty href="/syllabus-tracker" action="Open course tools">Your semester starts with a course. Add yours to get a clearer picture.</Empty>}
      <div className="course-tool-links"><ArrowLink href="/grade-calc">Grade calculator</ArrowLink><ArrowLink href="/syllabus-tracker">Syllabus tracker</ArrowLink></div>
      {preview && <p className="metadata">Sample course grades · Separate from GPA</p>}
    </>,
    focus: <FocusTimer studyMode={studyMode} onStudyMode={() => setStudyMode(!studyMode)} />,
  };
  const visibleColumns = columns.map((column) => column.filter(canShow)).filter((column) => column.length);
  const dock: { label: string; icon: IconName; color: string; href?: string; widget?: WidgetId }[] = [
    { label: "Courses", icon: "book", color: "blue", href: "/syllabus-tracker" },
    { label: "GPA", icon: "degree", color: "green", href: "/gpa-calc" },
    { label: "Grades", icon: "check", color: "coral", href: "/grade-calc" },
    { label: "Calendar", icon: "calendar", color: "yellow", href: "/syllabus-tracker?tab=calendar" },
    { label: "Syllabus", icon: "note", color: "pink", href: "/syllabus-tracker" },
    { label: "Study", icon: "timer", color: "charcoal", widget: "focus" },
    { label: "Widgets", icon: "widgets", color: "orange" },
  ];
  return <main id="main-content" className={`dashboard ${studyMode ? "is-studying" : ""}`}>
    <div className="greeting-row"><div><p className="workspace-context">{data.term} <span> / </span>{preview ? "Maya’s sample workspace" : "Your student workspace"}</p><h1>{studyMode ? "A little space to focus." : view === "personal" ? "Make a little room for you." : view === "academic" ? "A clearer view of your semester." : shown.name ? `Good morning, ${shown.name}.` : "A little structure. A lot of possibility."}{!studyMode && view === "overview" && shown.name && <span className="greeting-detail"> {todayClasses} classes, {todayTasks} assignments today.</span>}</h1></div><div className="greeting-actions"><button className="button dark" aria-pressed={studyMode} onClick={() => setStudyMode(!studyMode)}><Icon name="timer" />{studyMode ? "Exit study mode" : "Study mode"}</button><button className="button" onClick={(event) => openCustomize(event.currentTarget)}><Icon name="sliders" />Customize</button></div></div>
    {preview && <div className="demo-toolbar"><span><span className="demo-dot" />Sample data. A space to explore, no sign-in needed.</span><button className="text-button" aria-pressed={empty} onClick={() => setEmpty(!empty)}>{empty ? "Show sample data" : "Explore empty states"}<Icon name="arrow" /></button></div>}
    {data.notice && <p className="data-notice" role="status">{data.notice}</p>}
    {studyMode && <p className="study-mode-status" role="status">Study mode is on · Just your timer and what’s next.</p>}
    <div className={`dashboard-grid columns-${visibleColumns.length}`}>
      {visibleColumns.map((column) => <div className="widget-column" key={columns.findIndex((group) => group.includes(column[0]))}>{column.map((id) => <section key={id} id={`widget-${id}`} aria-label={widgets[id]} tabIndex={-1} className={`dashboard-card card-${id}`}>{content[id]}</section>)}</div>)}
    </div>
    {!visibleColumns.length && <div className="all-hidden"><h2>A little more breathing room.</h2><p>All widgets in this view are hidden. Bring a few back when you’re ready.</p><button className="button dark" onClick={() => setHidden([])}>Restore widgets</button></div>}
    <div className="workspace-bottom"><span>{preview ? "Demo day" : "Today"} · {format(parseISO(data.date), "EEEE, MMMM d")}</span></div>
    <nav className="app-dock" aria-label="Student apps">{dock.map((item) => {
      const child = <><span className={`dock-tile tile-${item.color}`}><Icon name={item.icon} /></span><span>{item.label}</span></>;
      return item.href ? <Link className="dock-item" key={item.label} href={item.href}>{child}</Link> : <button className="dock-item" key={item.label} aria-pressed={item.widget ? studyMode : undefined} onClick={(event) => item.widget ? focusWidget(item.widget) : openCustomize(event.currentTarget)}>{child}</button>;
    })}</nav>
    <dialog
      ref={customizeRef}
      className="customize-dialog"
      aria-labelledby="customize-title"
      onClose={() => customizeTriggerRef.current?.focus()}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href], [tabindex='0']");
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <div className="dialog-heading"><span className="eyebrow">Make it yours</span><button className="icon-button" aria-label="Close customization" onClick={() => customizeRef.current?.close()}><Icon name="close" /></button></div>
      <h2 id="customize-title">Your space, arranged for you.</h2><p>Choose what belongs on your dashboard. Preferences are saved on this device.</p>
      <fieldset><legend className="sr-only">Visible widgets</legend>{Object.entries(widgets).map(([id, label]) => <label className="widget-toggle" key={id}><span>{label}</span><input type="checkbox" checked={!hidden.includes(id as WidgetId)} onChange={() => setHidden(hidden.includes(id as WidgetId) ? hidden.filter((item) => item !== id) : [...hidden, id as WidgetId])} /></label>)}</fieldset>
      <p className="metadata">Academic and Personal views show their relevant widgets. Study mode always shows the timer and assignments.</p><div className="dialog-footer"><button className="text-button" onClick={() => setHidden([])}>Restore defaults</button><button className="button dark" onClick={() => customizeRef.current?.close()}>All set</button></div>
    </dialog>
  </main>;
}
