/** Largest PDF a route will parse. The multipart request may be slightly larger. */
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

export const PDF_REQUEST_MAX_BYTES = PDF_MAX_BYTES + 64 * 1024;

export const PDF_MAX_PAGES = 10;

export const PDF_PARSE_TIMEOUT_MS = 15_000;
