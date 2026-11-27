import { parseTranscriptText } from "@/apps/course-planner/backend/parseTranscript";
import { isSjsuEmail } from "@/utils/auth/sjsuEmail";
import { extractPdfText } from "@/utils/pdf/extractPdfText";
import { PdfReadError } from "@/utils/pdf/pdfReadError";
import { readUploadedPdf } from "@/utils/pdf/readUploadedPdf";
import { getAuthUser } from "@/utils/supabase/server";

export const runtime = "nodejs";

const unreadable = "The PDF could not be read. Try a text-based transcript PDF.";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json(
      { error: "Sign in with your SJSU account to upload a transcript." },
      { status: 401 },
    );
  }
  if (!user.email || !isSjsuEmail(user.email)) {
    return Response.json(
      { error: "Use your SJSU email address to upload a transcript." },
      { status: 403 },
    );
  }

  try {
    const bytes = await readUploadedPdf(request, "transcript");
    const text = await extractPdfText(bytes, {
      invalidMessage: "Please upload a PDF transcript.",
      unreadableMessage: unreadable,
    });
    const courses = parseTranscriptText(text);
    if (courses.length === 0) {
      return Response.json(
        { error: "No courses were found in that transcript." },
        { status: 422 },
      );
    }
    return Response.json({ courses });
  } catch (error) {
    if (error instanceof PdfReadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: unreadable }, { status: 422 });
  }
}
