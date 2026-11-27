import { describe, expect, it } from "vitest";
import { extractPdfText } from "./extractPdfText";
import { PDF_REQUEST_MAX_BYTES } from "./limits";
import { PdfReadError } from "./pdfReadError";
import { readUploadedPdf } from "./readUploadedPdf";

function pdfWithText(lines: string[]) {
  const commands = ["BT", "/F1 12 Tf"];
  lines.forEach((line, index) => {
    commands.push(index === 0 ? "72 720 Td" : "0 -16 Td");
    commands.push(`(${line}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  return encodePdf(objects);
}

function pdfWithPageCount(count: number) {
  const kids = Array.from({ length: count }, (_, index) => `${index + 3} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`,
  ];
  for (let page = 0; page < count; page += 1) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>`);
  }
  return encodePdf(objects);
}

function encodePdf(objects: string[]) {
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    trailer += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body + trailer);
}

function upload(bytes: Uint8Array, type = "application/pdf") {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const form = new FormData();
  form.set("file", new File([copy], "upload.pdf", { type }));
  return new Request("http://local/upload", { method: "POST", body: form });
}

describe("extractPdfText", () => {
  it("keeps text on separate lines", async () => {
    const text = await extractPdfText(pdfWithText(["Fall 2024", "CS 146"]));
    expect(text).toContain("Fall 2024");
    expect(text).toContain("CS 146");
    expect(text).toMatch(/Fall 2024\nCS 146/);
  });

  it("rejects a file that does not start with the PDF header", async () => {
    await expect(extractPdfText(new TextEncoder().encode("not a pdf"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("stops when the page count is over the cap", async () => {
    await expect(extractPdfText(pdfWithPageCount(3), { maxPages: 2 })).rejects.toThrow(
      "The PDF must be 2 pages or fewer.",
    );
  });
});

describe("readUploadedPdf", () => {
  it("rejects a declared body over the limit before reading it", async () => {
    let read = false;
    const request = {
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-length" ? String(PDF_REQUEST_MAX_BYTES + 1) : null;
        },
      },
      body: {
        getReader() {
          read = true;
          throw new Error("body should not be read");
        },
      },
    } as unknown as Request;

    await expect(readUploadedPdf(request, "transcript")).rejects.toMatchObject({ status: 413 });
    expect(read).toBe(false);
  });

  it("stops reading once the byte cap is passed", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let pulls = 0;
    const request = {
      headers: {
        get() {
          return null;
        },
      },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          if (pulls > 30) {
            controller.close();
            return;
          }
          controller.enqueue(chunk);
        },
      }),
    } as unknown as Request;

    await expect(readUploadedPdf(request, "transcript")).rejects.toBeInstanceOf(PdfReadError);
    expect(pulls).toBeLessThan(20);
  });

  it("rejects a non-PDF payload even when the part type says PDF", async () => {
    const request = upload(new TextEncoder().encode("hello"), "application/pdf");
    await expect(readUploadedPdf(request, "transcript")).rejects.toMatchObject({
      status: 400,
      message: "Please upload a PDF transcript.",
    });
  });

  it("returns the PDF bytes from a multipart upload", async () => {
    const bytes = pdfWithText(["CS 151"]);
    const uploaded = await readUploadedPdf(upload(bytes, "application/octet-stream"), "syllabus");
    expect(uploaded[0]).toBe(bytes[0]);
    await expect(extractPdfText(uploaded)).resolves.toContain("CS 151");
  });
});
