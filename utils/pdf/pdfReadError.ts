export class PdfReadError extends Error {
  readonly status: 400 | 413 | 422;

  constructor(message: string, status: 400 | 413 | 422) {
    super(message);
    this.name = "PdfReadError";
    this.status = status;
  }
}
