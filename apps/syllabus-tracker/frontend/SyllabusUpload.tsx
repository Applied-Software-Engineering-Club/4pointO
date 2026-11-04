"use client";

import { useState } from "react";
import type { UserCourseDraft } from "@/apps/syllabus-tracker/backend/courses/userCourse";

type ParsedFields = Pick<
  UserCourseDraft,
  | "courseNumber"
  | "courseName"
  | "courseDays"
  | "courseStart"
  | "courseEnd"
  | "officeHoursDays"
  | "officeHoursStart"
  | "officeHoursEnd"
  | "professorName"
  | "professorEmail"
  | "prerequisites"
>;

export function SyllabusUpload({ onParsed }: { onParsed: (fields: ParsedFields) => void }) {
  const [status, setStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Choose a PDF syllabus.");
      return;
    }

    setStatus("reading");
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-syllabus", { method: "POST", body: formData });
      const data = (await response.json()) as ParsedFields & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The syllabus could not be parsed.");
      onParsed(data);
      setStatus("done");
      setMessage("Fields filled in. Review them before saving.");
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : "The syllabus could not be parsed.");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-neutral-900">Import from syllabus PDF</span>
          <span className="block text-xs text-neutral-500">Only course and instructor details are extracted.</span>
        </span>
        <span className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900">
          {status === "reading" ? "Reading…" : "Choose PDF"}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={status === "reading"}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </label>
      {message ? (
        <p className={`mt-2 text-xs ${status === "error" ? "text-red-700" : "text-neutral-600"}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
