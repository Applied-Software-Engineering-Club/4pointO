"use client";

import { useEffect, useRef, useState } from "react";
import { AddCourseDialog, type AddCourseDialogHandle } from "./AddCourseDialog";
import { calculateCgpa, calculateSemesterGpa, isSupportedGrade, LETTER_GRADES, type GradeRecord, type Semester } from "../backend/gpa-service";
import { createSemester, removeSemester as removeSemesterFromList } from "../backend/semester-service";
import { applyWhatIf, applyWhatIfToSemesters } from "../backend/what-if-service";
import { loadSemesters, saveSemesters } from "./storage";

const seasons = ["Fall", "Spring", "Summer"];
const defaultYear = String(new Date().getFullYear());
const initialSemesters: Semester[] = [{ id: "semester-1", season: "Fall", year: defaultYear, records: [{ id: "cs-151", courseId: "cs-151", courseName: "CS 151", units: 3, season: "Fall", year: defaultYear, letterGrade: "B+", percentGrade: "89.51" }] }];
const controlClass = "cursor-pointer appearance-none border-0 bg-transparent bg-[length:0.65rem] bg-[position:right_center] bg-no-repeat p-0 pr-[0.85rem] font-medium text-inherit outline-none";
const arrow = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' stroke='%23737373' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")" };
const button = "rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50";
const activeButton = "rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white";

function display(value: number | null) { return value === null ? "N/A" : value.toFixed(2); }

export function GpaCalculator() {
  const addCourseDialogRef = useRef<AddCourseDialogHandle>(null);
  const [semesters, setSemesters] = useState(initialSemesters);
  const [activeId, setActiveId] = useState(initialSemesters[0].id);
  const [editing, setEditing] = useState(false);
  const [whatIfEnabled, setWhatIfEnabled] = useState(false);
  const [whatIfChanges, setWhatIfChanges] = useState<Record<string, Partial<GradeRecord>>>({});
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => { const saved = loadSemesters(); if (saved?.length) { setSemesters(saved); setActiveId(saved[0].id); } }, []);
  const active = semesters.find((semester) => semester.id === activeId) ?? semesters[0];
  const scenarioRecords = active.records.map((record) => applyWhatIf(record, whatIfChanges));
  const semesterResult = calculateSemesterGpa(whatIfEnabled ? scenarioRecords : active.records);
  const cgpaResult = calculateCgpa(whatIfEnabled ? applyWhatIfToSemesters(semesters, whatIfChanges) : semesters);

  function updateSemester(field: "season" | "year", value: string) { setSemesters((current) => current.map((semester) => semester.id === activeId ? { ...semester, [field]: value, records: semester.records.map((record) => ({ ...record, [field]: value })) } : semester)); }
  function addSemester() { const semester = createSemester("Fall", defaultYear); setSemesters((current) => [...current, semester]); setActiveId(semester.id); setEditing(true); }
  function removeSemester() {
    const removed = semesters.find((semester) => semester.id === activeId);
    const removedRecordIds = new Set(removed?.records.map((record) => record.id));
    const result = removeSemesterFromList(semesters, activeId);
    setSemesters(result.semesters);
    setActiveId(result.activeId);
    setWhatIfChanges((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removedRecordIds.has(id))));
  }
  function updateRecord(id: string, field: keyof GradeRecord, value: string | number) { if (whatIfEnabled) { setWhatIfChanges((current) => ({ ...current, [id]: { ...current[id], [field]: value } })); return; } setSemesters((current) => current.map((semester) => semester.id === activeId ? { ...semester, records: semester.records.map((record) => record.id === id ? { ...record, [field]: value } : record) } : semester)); }
  function removeRecord(id: string) { setSemesters((current) => current.map((semester) => semester.id === activeId ? { ...semester, records: semester.records.filter((record) => record.id !== id) } : semester)); setWhatIfChanges((current) => { const next = { ...current }; delete next[id]; return next; }); }
  function appendCourse(idPrefix: string, courseName: string) { const record: GradeRecord = { id: `${idPrefix}-${crypto.randomUUID()}`, courseId: idPrefix, courseName, units: 3, season: active.season, year: active.year, letterGrade: "", percentGrade: "" }; setSemesters((current) => current.map((semester) => semester.id === activeId ? { ...semester, records: [...semester.records, record] } : semester)); setEditing(true); }
  function save() { setSaveMessage(saveSemesters(semesters) ? "Saved" : "Could not save"); window.setTimeout(() => setSaveMessage(""), 1800); }

  return <main className="flex-1 bg-white px-6 py-6"><section className="mx-auto max-w-4xl" aria-label="GPA calculator">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-lg font-semibold text-neutral-900">GPA Calculator</h1><p className="mt-1 text-sm text-neutral-500">Track grades by semester and test future results.</p></div><div className="flex gap-2"><button type="button" className={whatIfEnabled ? activeButton : button} onClick={() => { setWhatIfEnabled((value) => !value); setWhatIfChanges({}); }}>{whatIfEnabled ? "Exit what if" : "What if"}</button><button type="button" className={button} onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit"}</button><button type="button" className={button} onClick={save}>Save</button></div></div>
    <p aria-live="polite" className="mt-2 h-5 text-sm text-green-700">{saveMessage}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3"><label className="text-xs font-medium text-neutral-500" htmlFor="semester-select">Semester</label><select id="semester-select" value={active.id} onChange={(event) => setActiveId(event.target.value)} className={`${controlClass} text-sm`} style={arrow}>{semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.season} {semester.year}</option>)}</select>{editing && <><select aria-label="Semester season" value={active.season} onChange={(event) => updateSemester("season", event.target.value)} className={`${controlClass} text-sm`} style={arrow}>{seasons.map((season) => <option key={season}>{season}</option>)}</select><input aria-label="Semester year" value={active.year} onChange={(event) => updateSemester("year", event.target.value.replace(/\D/g, "").slice(0, 4))} className="w-12 bg-transparent text-sm outline-none" inputMode="numeric" /></>}<button type="button" className={`${button} ml-auto`} onClick={addSemester}>New semester</button><button type="button" disabled={semesters.length <= 1} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={removeSemester}>Remove semester</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-neutral-200 p-3"><p className="text-xs text-neutral-500">Semester GPA</p><p className="mt-1 text-2xl font-semibold">{display(semesterResult.gpa)}</p><p className="text-xs text-neutral-500">{semesterResult.includedUnits} included units</p></div><div className="rounded-xl border border-neutral-200 p-3"><p className="text-xs text-neutral-500">Cumulative GPA</p><p className="mt-1 text-2xl font-semibold">{display(cgpaResult.gpa)}</p><p className="text-xs text-neutral-500">{cgpaResult.includedUnits} included units</p></div><div className="rounded-xl border border-neutral-200 p-3"><p className="text-xs text-neutral-500">Scale</p><p className="mt-1 text-2xl font-semibold">0–4.0</p><p className="text-xs text-neutral-500">SJSU grade points</p></div></div>
    <div className="mt-6 flex items-center justify-between"><h2 className="text-base font-semibold">Courses</h2><button type="button" className={button} onClick={() => addCourseDialogRef.current?.open()}>Add course</button></div><div className="mt-3 grid grid-cols-[minmax(7rem,1.5fr)_4rem_7rem_6rem_1.2rem] gap-2 px-3 text-xs text-neutral-500"><span>Course</span><span>Units</span><span>Letter grade</span><span>Percent</span><span /></div>
    <ul className="mt-2 flex flex-col gap-2">{active.records.map((record) => { const row = whatIfEnabled ? { ...record, ...whatIfChanges[record.id] } : record; const adjustable = editing || whatIfEnabled; const unknownGrade = Boolean(row.letterGrade) && !isSupportedGrade(row.letterGrade); return <li key={record.id} className="grid grid-cols-[minmax(7rem,1.5fr)_4rem_7rem_6rem_1.2rem] items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium"><span>{record.courseName}</span>{adjustable ? <input aria-label={`Units for ${record.courseName}`} type="number" min="0.5" max="6" step="0.5" value={row.units} onChange={(event) => updateRecord(record.id, "units", Number(event.target.value))} className="w-12 bg-transparent outline-none" /> : <span>{record.units}</span>}{adjustable ? <select aria-label={`Letter grade for ${record.courseName}`} aria-invalid={unknownGrade || undefined} title={unknownGrade ? "Unknown grade" : undefined} value={row.letterGrade} onChange={(event) => updateRecord(record.id, "letterGrade", event.target.value)} className={`${controlClass}${unknownGrade ? " text-red-700" : ""}`} style={arrow}><option value="">—</option>{LETTER_GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select> : <span className={unknownGrade ? "text-red-700" : undefined} title={unknownGrade ? "Unknown grade" : undefined}>{row.letterGrade || "—"}</span>}{adjustable ? <input aria-label={`Percent grade for ${record.courseName}`} inputMode="decimal" value={row.percentGrade} onChange={(event) => updateRecord(record.id, "percentGrade", event.target.value)} className="w-14 bg-transparent outline-none" placeholder="—" /> : <span>{row.percentGrade ? `${row.percentGrade}%` : "—"}</span>}<button type="button" aria-label={`Remove ${record.courseName}`} onClick={() => removeRecord(record.id)} className="text-lg leading-none text-red-600">×</button></li>; })}</ul>
    {!active.records.length && <p className="mt-4 rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">No courses in this semester yet.</p>}
  </section><AddCourseDialog ref={addCourseDialogRef} onAdd={appendCourse} /></main>;
}
