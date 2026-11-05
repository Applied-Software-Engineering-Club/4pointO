declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfData = { text: string };
  const pdfParse: (data: Buffer) => Promise<PdfData>;
  export default pdfParse;
}
