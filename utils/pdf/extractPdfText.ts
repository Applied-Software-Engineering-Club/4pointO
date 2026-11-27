import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDF_MAX_PAGES, PDF_PARSE_TIMEOUT_MS } from "./limits";
import { PdfReadError } from "./pdfReadError";

const require = createRequire(import.meta.url);
const standardFontDataUrl = pathToFileURL(
  path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") +
    path.sep,
).href;

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];

export type ExtractPdfTextOptions = {
  maxPages?: number;
  timeoutMs?: number;
  invalidMessage?: string;
  unreadableMessage?: string;
};

function hasPdfHeader(bytes: Uint8Array) {
  return PDF_HEADER.every((byte, index) => bytes[index] === byte);
}

function textFromItems(items: unknown[]) {
  let text = "";
  let lastY: number | undefined;

  for (const item of items) {
    if (typeof item !== "object" || item === null || !("str" in item)) {
      continue;
    }
    const str = item.str;
    if (typeof str !== "string" || !str) {
      continue;
    }
    const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : [];
    const y = transform[5];
    const nextY = typeof y === "number" ? y : undefined;
    if (lastY === undefined || nextY === lastY) {
      text += str;
    } else {
      text += `\n${str}`;
    }
    if (nextY !== undefined) {
      lastY = nextY;
    }
  }

  return text;
}

export async function extractPdfText(
  bytes: Uint8Array,
  options: ExtractPdfTextOptions = {},
): Promise<string> {
  const invalidMessage = options.invalidMessage ?? "Please upload a PDF.";
  const unreadableMessage = options.unreadableMessage ?? "The PDF could not be read.";
  const maxPages = options.maxPages ?? PDF_MAX_PAGES;
  const timeoutMs = options.timeoutMs ?? PDF_PARSE_TIMEOUT_MS;

  if (!hasPdfHeader(bytes)) {
    throw new PdfReadError(invalidMessage, 400);
  }

  // PDF.js 4.2.67 removed the eval path behind CVE-2024-4367. 6.x no longer
  // types this flag; passing false keeps an older build from turning eval back on.
  const parameters = {
    data: bytes,
    isEvalSupported: false,
    standardFontDataUrl,
    disableStream: true,
    disableAutoFetch: true,
    disableRange: true,
    useWasm: false,
    verbosity: 0,
  };
  const task = getDocument(parameters);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void task.destroy();
      reject(new PdfReadError(unreadableMessage, 422));
    }, timeoutMs);
  });

  const fail = (error: unknown): never => {
    if (timedOut || error instanceof PdfReadError) {
      throw error instanceof PdfReadError ? error : new PdfReadError(unreadableMessage, 422);
    }
    throw new PdfReadError(unreadableMessage, 422);
  };

  try {
    const pdf = await Promise.race([task.promise, timeout]);
    if (pdf.numPages > maxPages) {
      throw new PdfReadError(`The PDF must be ${maxPages} pages or fewer.`, 422);
    }

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await Promise.race([pdf.getPage(pageNumber), timeout]);
      const content = await Promise.race([page.getTextContent(), timeout]);
      pages.push(textFromItems(content.items));
    }
    return pages.join("\n");
  } catch (error) {
    return fail(error);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    await task.destroy().catch(() => undefined);
  }
}
