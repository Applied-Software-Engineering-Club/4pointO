import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parseTranscriptText } from "@/apps/course-planner/backend/parseTranscript";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return Response.json({ error: "Please upload a PDF transcript." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json(
      { error: "The transcript must be smaller than 10 MB." },
      { status: 400 },
    );
  }

  try {
    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()));
    const courses = parseTranscriptText(parsed.text);
    if (courses.length === 0) {
      return Response.json(
        { error: "No courses were found in that transcript." },
        { status: 422 },
      );
    }
    return Response.json({ courses });
  } catch {
    return Response.json(
      { error: "The PDF could not be read. Try a text-based transcript PDF." },
      { status: 422 },
    );
  }
}
