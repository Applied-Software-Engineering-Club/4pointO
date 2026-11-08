import { describe, expect, it } from "vitest";
import { auditDegree, type DegreeProgram, type ProgramRequirement } from "./degreeAudit";
import { parseTranscript, type TranscriptCourse } from "./parseTranscript";

function course(code: string, grade: string, units = 3, overrides: Partial<TranscriptCourse> = {}): TranscriptCourse {
  return {
    code,
    title: code,
    units: String(units),
    letterGrade: grade,
    points: "",
    season: "Fall",
    year: "2025",
    attemptedUnits: String(units),
    gpaUnits: String(units),
    earnedUnits: String(units),
    ...overrides,
  };
}

function requirement(overrides: Partial<ProgramRequirement>): ProgramRequirement {
  return {
    title: "Requirement",
    rule: "all_of",
    units: null,
    min_grade: null,
    courses: [],
    source_text: "",
    children: [],
    ...overrides,
  };
}

function program(requirements: ProgramRequirement[], total: number | null = 120): DegreeProgram {
  return { catalog_id: "23", name: "Test, BS", total_units: total, source_url: "https://example.test", requirements };
}

const electives = ["CS 1", "CS 2", "CS 3", "CS 4", "CS 5"];
const twelveUnits = requirement({ title: "Electives", rule: "choose_units", units: 12, courses: electives });

describe("12 elective units from a list", () => {
  it.each([
    { taken: 0, status: "unmet", completed: 0, needed: 12 },
    { taken: 2, status: "unmet", completed: 6, needed: 6 },
    { taken: 4, status: "met", completed: 12, needed: 0 },
    { taken: 5, status: "met", completed: 15, needed: 0 },
  ])("reports $taken courses", ({ taken, status, completed, needed }) => {
    const courses = electives.slice(0, taken).map((code) => course(code, "B"));
    const [result] = auditDegree(program([twelveUnits]), courses).requirements;
    expect(result).toMatchObject({ status, unitsCompleted: completed, unitsNeeded: needed });
  });
});

describe("grades", () => {
  it.each(["F", "W", "WU", "NC", "I", "AU"])("%s earns no credit", (grade) => {
    const audit = auditDegree(program([twelveUnits]), [course("CS 1", grade, 3, { earnedUnits: "0" })]);
    expect(audit.requirements[0].unitsCompleted).toBe(0);
    expect(audit.totalUnits.completed).toBe(0);
    expect(audit.notCountedCourses).toMatchObject([{ code: "CS 1", reason: "no_credit" }]);
  });

  it("respects a minimum grade", () => {
    const required = requirement({ courses: ["CS 1"], min_grade: "C-" });
    expect(auditDegree(program([required]), [course("CS 1", "D+")]).requirements[0].status).toBe("unmet");
    expect(auditDegree(program([required]), [course("CS 1", "C-")]).requirements[0].status).toBe("met");
    expect(auditDegree(program([required]), [course("CS 1", "CR")]).requirements[0].status).toBe("unmet");
  });
});

describe("repeats", () => {
  it("counts the best passing attempt once", () => {
    const audit = auditDegree(program([requirement({ courses: ["CS 1"] })]), [
      course("CS 1", "F", 3, { earnedUnits: "0" }),
      course("CS 1", "C"),
      course("CS 1", "A", 3, { year: "2026" }),
    ]);
    expect(audit.requirements[0].appliedCourses).toMatchObject([{ code: "CS 1", grade: "A", units: 3 }]);
    expect(audit.totalUnits.completed).toBe(3);
    expect(audit.notCountedCourses.map((item) => item.reason).sort()).toEqual(["no_credit", "repeated"]);
  });
});

describe("double counting", () => {
  it("fills a required course before an elective pool", () => {
    const audit = auditDegree(
      program([
        requirement({ title: "Pool", rule: "choose_units", units: 3, courses: ["MATH 1", "MATH 2"] }),
        requirement({ title: "Pick one", rule: "choose_courses", units: 3, courses: ["MATH 1"] }),
      ]),
      [course("MATH 1", "A")],
    );
    expect(audit.requirements[1].status).toBe("met");
    expect(audit.requirements[0].status).toBe("unmet");
  });
});

describe("statuses", () => {
  it("marks in-progress units separately", () => {
    const [result] = auditDegree(program([requirement({ rule: "choose_units", units: 6, courses: ["CS 1", "CS 2"] })]), [
      course("CS 1", "A"),
      course("CS 2", "IP", 3, { earnedUnits: "0" }),
    ]).requirements;
    expect(result).toMatchObject({ status: "in_progress", unitsCompleted: 3, unitsInProgress: 3, unitsNeeded: 0 });
  });

  it("never marks an unparsed requirement as met", () => {
    const [result] = auditDegree(program([requirement({ rule: "unparsed", units: 3, courses: ["CS 1"] })]), [
      course("CS 1", "A"),
    ]).requirements;
    expect(result).toMatchObject({ status: "manual_check", unitsCompleted: 3, unitsNeeded: 0 });
  });

  it("lists the courses an unparsed requirement has not counted yet", () => {
    const [result] = auditDegree(program([requirement({ rule: "unparsed", units: 6, courses: ["CS 1", "CS 2"] })]), [
      course("CS 1", "A"),
    ]).requirements;
    expect(result.otherListedCourses).toEqual(["CS 2"]);
    expect(result.missingCourses).toEqual([]);
  });

  it("does not let a parent be met when a child needs a manual check", () => {
    const parent = requirement({
      rule: "all_of",
      units: 6,
      courses: ["CS 1"],
      children: [requirement({ rule: "unparsed", units: 3, courses: ["CS 2"] })],
    });
    const [result] = auditDegree(program([parent]), [course("CS 1", "A"), course("CS 2", "A")]).requirements;
    expect(result).toMatchObject({ status: "manual_check", unitsCompleted: 6 });
  });

  it("uses transcript units for variable-unit courses", () => {
    const [result] = auditDegree(program([requirement({ rule: "choose_units", units: 2, courses: ["CS 180"] })]), [
      course("CS 180", "A", 1),
    ]).requirements;
    expect(result).toMatchObject({ status: "unmet", unitsCompleted: 1, unitsNeeded: 1 });
  });

  it("lists unmatched courses and adds external units to the total", () => {
    const audit = auditDegree(program([requirement({ courses: ["CS 1"] })]), [course("ART 1", "A")], 18);
    expect(audit.unmatchedCourses).toMatchObject([{ code: "ART 1", units: 3 }]);
    expect(audit.totalUnits).toEqual({ required: 120, completed: 21, inProgress: 0, needed: 99 });
  });
});

describe("parseTranscript", () => {
  const text = `
EXTERNAL CREDIT                           UE       TERM          SCORE
Example College                           5.0    SPRING 2024
AP Example Exam                           3.0    FALL  2023          4
EXTERNAL CREDIT TOTALS             UG     UE    GP    GPA
FALL SEMESTER  2023
MAJOR: BS Example
                                    UA     UG     UE    GR   GP   GPA
CS    46A    Intro to Programming   4.0    4.0    4.0   A   16.0
ENGL1AFirstYearWriting3 03 03 0A12 0
ENGL  1A     First Year Writing     3.0    3.0    3.0   B+   9.9
MATH  33LA   Diff Eq and Linear A   3.0    3.0    3.0   C    6.0
ENGL  1A     First Year Writing     3.0    3.0    3.0   B+   9.9
BUS1  20     Example Business       3.0    0.0    3.0   CR   0.0
CS    47     Computer Systems       3.0    3.0    0.0   F    0.0
         SEMESTER TOTAL:           16.0   16.0   16.0       61.9  3.868
         EXTERNAL CREDIT:                  0.0    3.0        0.0  0.000
SPRING SEMESTER  2024
                                    UA     UG     UE    GR   GP   GPA
AAS   1      Example Studies        3.0    3.0    3.0   A   12.0
FALL SEMESTER  2026
                                    IN PROGRESS
SPRING SEMESTER  2027
ENROLLED
`;

  it("reads MySJSU rows, including multi-letter course numbers", () => {
    const { courses } = parseTranscript(text);
    expect(courses.map((item) => item.code)).toEqual(["CS 46A", "ENGL 1A", "MATH 33LA", "BUS1 20", "CS 47", "AAS 1"]);
    expect(courses[3]).toMatchObject({ attemptedUnits: "3", gpaUnits: "0", earnedUnits: "3", units: "3", letterGrade: "CR" });
    expect(courses[4]).toMatchObject({ attemptedUnits: "3", earnedUnits: "0", letterGrade: "F" });
    expect(courses[5]).toMatchObject({ season: "Spring", year: "2024" });
  });

  it("reads external credit without treating it as a term", () => {
    const { courses, externalCredits } = parseTranscript(text);
    expect(externalCredits).toEqual([
      { source: "Example College", units: 5, season: "Spring", year: "2024" },
      { source: "AP Example Exam", units: 3, season: "Fall", year: "2023" },
    ]);
    expect(courses[0]).toMatchObject({ season: "Fall", year: "2023" });
  });
});
