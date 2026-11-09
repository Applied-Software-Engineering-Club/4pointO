// Print a degree audit for a transcript PDF. Nothing is saved or uploaded, and
// only course rows are printed, not the student details on the transcript.
//
// Usage:
//   node utils/program_scraping/audit_transcript.mjs <transcript.pdf> <program.json>
// Example:
//   node utils/program_scraping/audit_transcript.mjs ~/Downloads/transcript.pdf utils/data/programs/software-engineering-bs.json

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { auditDegree } from "../../apps/course-planner/backend/degreeAudit.ts";
import { parseTranscript } from "../../apps/course-planner/backend/parseTranscript.ts";

const [pdfPath, programPath] = process.argv.slice(2);
if (!pdfPath || !programPath) {
  console.error("Usage: node utils/program_scraping/audit_transcript.mjs <transcript.pdf> <program.json>");
  process.exit(1);
}

const pdfParse = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js");
const parsed = await pdfParse(await readFile(pdfPath));
const { courses, externalCredits } = parseTranscript(parsed.text);
const program = JSON.parse(await readFile(programPath, "utf8"));
const externalUnits = externalCredits.reduce((total, item) => total + item.units, 0);
const audit = auditDegree(program, courses, externalUnits);

const labels = { met: "MET", in_progress: "IN PROGRESS", unmet: "NOT MET", manual_check: "CHECK MANUALLY" };

function printRequirement(result, depth = 0) {
  const indent = "  ".repeat(depth);
  const required = result.unitsRequired === null ? "" : ` / ${result.unitsRequired}`;
  console.log(`${indent}[${labels[result.status]}] ${result.title}: ${result.unitsCompleted}${required} units`);
  if (result.appliedCourses.length > 0) {
    console.log(`${indent}    counted: ${result.appliedCourses.map((item) => `${item.code} (${item.grade})`).join(", ")}`);
  }
  if (result.missingCourses.length > 0) {
    console.log(`${indent}    missing: ${result.missingCourses.join(", ")}`);
  }
  if (result.otherListedCourses.length > 0) {
    console.log(`${indent}    listed, not counted yet: ${result.otherListedCourses.join(", ")}`);
  }
  for (const child of result.children) {
    printRequirement(child, depth + 1);
  }
}

console.log(`UNOFFICIAL ESTIMATE: ${audit.programName}, catalog ${audit.catalogId}`);
console.log("Confirm with MyPlanner and your major advisor.");
console.log(`Source: ${audit.sourceUrl}\n`);
const { required, completed, needed } = audit.totalUnits;
console.log(`Total units: ${completed} / ${required ?? "?"} (${needed ?? "?"} still needed)\n`);
audit.requirements.forEach((result) => printRequirement(result));

console.log(`\nCourses read from the PDF: ${courses.length}`);
console.log(`Other SJSU courses, not matched to a requirement: ${audit.unmatchedCourses.map((item) => item.code).join(", ") || "none"}`);
console.log(`Attempts not counted: ${audit.notCountedCourses.map((item) => `${item.code} (${item.reason})`).join(", ") || "none"}`);
if (externalUnits > 0) {
  console.log(`\nExternal credit: ${externalUnits} units count toward the total, but the transcript lists no course names.`);
  console.log("They can't be matched to requirements, so a course marked missing may already be covered by them.");
}
