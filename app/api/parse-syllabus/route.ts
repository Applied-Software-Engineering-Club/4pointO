import { extractPdfText } from "@/utils/pdf/extractPdfText";
import { PdfReadError } from "@/utils/pdf/pdfReadError";
import { readUploadedPdf } from "@/utils/pdf/readUploadedPdf";

export const runtime = "nodejs";

type SyllabusFields = {
  courseNumber: string;
  courseName: string;
  courseDays: string;
  courseStart: string;
  courseEnd: string;
  officeHoursDays: string;
  officeHoursStart: string;
  officeHoursEnd: string;
  professorName: string;
  professorEmail: string;
  prerequisites: string;
};

const emptyFields = (): SyllabusFields => ({
  courseNumber: "",
  courseName: "",
  courseDays: "",
  courseStart: "",
  courseEnd: "",
  officeHoursDays: "",
  officeHoursStart: "",
  officeHoursEnd: "",
  professorName: "",
  professorEmail: "",
  prerequisites: "",
});

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function labeled(text: string, label: RegExp) {
  const match = text.match(new RegExp(`^\\s*(?:${label.source})\\s*[:\\-–]\\s*(.+)$`, "im"));
  return match ? clean(match[match.length - 1] ?? "") : "";
}

function timeRange(value: string) {
  const match = value.match(
    /([A-Za-z]+(?:\s*(?:[-/&]|and)\s*[A-Za-z]+)+).*?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*([ap]m)?/i,
  );
  if (!match) {
    return { days: "", start: "", end: "" };
  }

  const ampm = match[4]?.toLowerCase() ?? "am";
  const clock = (raw: string) => {
    let hour = Number(raw.split(":")[0]);
    const minute = Number(raw.split(":")[1]);
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  return { days: match[1], start: clock(match[2]), end: clock(match[3]) };
}

function parseSyllabusText(text: string): SyllabusFields {
  const normalized = text.normalize("NFKC");
  const fields = emptyFields();
  const header = normalized.match(/(?:^|\n)\s*([^\n]{3,100}?)\s*\n\s*([A-Z]{2,5}\s*\d{1,3}[A-Z]?)\s*\n/i);
  if (header) {
    fields.courseName = clean(header[1]);
    fields.courseNumber = clean(header[2]);
  }

  const meeting = timeRange(labeled(normalized, /(?:class|course)\s+(?:meeting(?:\s+time)?s?|timing)|meeting times?/i));
  fields.courseDays = meeting.days;
  fields.courseStart = meeting.start;
  fields.courseEnd = meeting.end;

  const officeHours = timeRange(labeled(normalized, /office hours?|student hours?|availability/i));
  fields.officeHoursDays = officeHours.days;
  fields.officeHoursStart = officeHours.start;
  fields.officeHoursEnd = officeHours.end;
  fields.professorName = labeled(normalized, /instructor(?:s)?|professor(?:s)?|faculty/i);
  fields.professorEmail = normalized.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  fields.prerequisites = labeled(normalized, /prerequisite(?:\(s\)|s)?|required background/i);
  return fields;
}

const unreadable = "The PDF could not be read. Try a text-based syllabus PDF.";

export async function POST(request: Request) {
  try {
    const bytes = await readUploadedPdf(request, "syllabus");
    const text = await extractPdfText(bytes, {
      invalidMessage: "Please upload a PDF syllabus.",
      unreadableMessage: unreadable,
    });
    return Response.json(parseSyllabusText(text));
  } catch (error) {
    if (error instanceof PdfReadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: unreadable }, { status: 422 });
  }
}
