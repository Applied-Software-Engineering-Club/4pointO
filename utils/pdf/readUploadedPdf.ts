import { PDF_MAX_BYTES, PDF_REQUEST_MAX_BYTES } from "./limits";
import { PdfReadError } from "./pdfReadError";

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];

function hasPdfHeader(bytes: Uint8Array) {
  return PDF_HEADER.every((byte, index) => bytes[index] === byte);
}

async function readCappedBody(request: Request, maxBytes: number, tooLarge: string) {
  const body = request.body;
  if (!body) {
    return new Uint8Array();
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      if (received + value.byteLength > maxBytes) {
        await reader.cancel();
        throw new PdfReadError(tooLarge, 413);
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readUploadedPdf(request: Request, label: "transcript" | "syllabus") {
  const missing = `Please upload a PDF ${label}.`;
  const tooLarge = `The ${label} must be smaller than 10 MB.`;
  const declared = request.headers.get("content-length");

  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      throw new PdfReadError(missing, 400);
    }
    if (length > PDF_REQUEST_MAX_BYTES) {
      throw new PdfReadError(tooLarge, 413);
    }
  }

  const raw = await readCappedBody(request, PDF_REQUEST_MAX_BYTES, tooLarge);
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("multipart/form-data")) {
    throw new PdfReadError(missing, 400);
  }

  let form: FormData;
  try {
    form = await new Request("http://local/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body: raw,
    }).formData();
  } catch {
    throw new PdfReadError(missing, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size > PDF_MAX_BYTES) {
    throw new PdfReadError(file instanceof File ? tooLarge : missing, file instanceof File ? 413 : 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    throw new PdfReadError(missing, 400);
  }
  return bytes;
}
