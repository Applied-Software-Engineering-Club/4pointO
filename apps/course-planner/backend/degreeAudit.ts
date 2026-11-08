import type { TranscriptCourse } from "./parseTranscript";

export type ProgramRequirement = {
  title: string;
  rule: "all_of" | "choose_units" | "choose_courses" | "pattern" | "unparsed";
  units: number | null;
  min_grade: string | null;
  courses: string[];
  source_text: string;
  children: ProgramRequirement[];
};

export type DegreeProgram = {
  catalog_id: string;
  name: string;
  total_units: number | null;
  source_url: string;
  requirements: ProgramRequirement[];
};

export type AuditStatus = "met" | "in_progress" | "unmet" | "manual_check";

export type AppliedCourse = {
  code: string;
  units: number;
  grade: string;
  inProgress: boolean;
};

export type RequirementResult = {
  title: string;
  rule: ProgramRequirement["rule"];
  status: AuditStatus;
  unitsRequired: number | null;
  unitsCompleted: number;
  unitsInProgress: number;
  unitsNeeded: number | null;
  appliedCourses: AppliedCourse[];
  missingCourses: string[];
  otherListedCourses: string[];
  sourceText: string;
  children: RequirementResult[];
};

export type NotCountedCourse = {
  code: string;
  grade: string;
  term: string;
  reason: "no_credit" | "repeated";
};

export type AuditResult = {
  programName: string;
  catalogId: string;
  sourceUrl: string;
  totalUnits: {
    required: number | null;
    completed: number;
    inProgress: number;
    needed: number | null;
  };
  externalUnits: number;
  requirements: RequirementResult[];
  unmatchedCourses: AppliedCourse[];
  notCountedCourses: NotCountedCourse[];
};

type Attempt = AppliedCourse & { used: boolean };
type RequirementNode = { requirement: ProgramRequirement; applied: Attempt[]; children: RequirementNode[] };

const GRADE_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
const NO_CREDIT_GRADES = new Set(["F", "WU", "W", "NC", "I", "IC", "AU", "NP"]);
const IN_PROGRESS_GRADES = new Set(["", "IP", "RD", "RP"]);
const ALLOCATION_ORDER: Record<ProgramRequirement["rule"], number> = {
  all_of: 0,
  choose_courses: 1,
  choose_units: 2,
  unparsed: 3,
  pattern: 4,
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, " ");
}

function gradeRank(grade: string) {
  return GRADE_ORDER.indexOf(grade);
}

function meetsMinimum(grade: string, minimum: string | null) {
  if (!minimum) {
    return true;
  }
  const rank = gradeRank(grade);
  return rank >= 0 && rank >= gradeRank(minimum.toUpperCase());
}

function toUnits(...values: string[]) {
  for (const value of values) {
    const amount = Number(value);
    if (value !== "" && Number.isFinite(amount)) {
      return amount;
    }
  }
  return 0;
}

function term(course: TranscriptCourse) {
  return [course.season, course.year].filter(Boolean).join(" ");
}

function isBetter(next: TranscriptCourse, current: TranscriptCourse) {
  const score = (course: TranscriptCourse) => {
    const grade = course.letterGrade.toUpperCase();
    if (NO_CREDIT_GRADES.has(grade)) {
      return -2;
    }
    if (IN_PROGRESS_GRADES.has(grade)) {
      return -1;
    }
    return gradeRank(grade);
  };
  return score(next) > score(current);
}

function selectAttempts(courses: TranscriptCourse[]) {
  const best = new Map<string, TranscriptCourse>();
  const notCounted: NotCountedCourse[] = [];
  const skip = (course: TranscriptCourse, reason: NotCountedCourse["reason"]) => {
    notCounted.push({
      code: normalizeCode(course.code),
      grade: course.letterGrade.toUpperCase(),
      term: term(course),
      reason,
    });
  };

  for (const course of courses) {
    const grade = course.letterGrade.toUpperCase();
    if (NO_CREDIT_GRADES.has(grade)) {
      skip(course, "no_credit");
      continue;
    }
    const code = normalizeCode(course.code);
    const current = best.get(code);
    if (!current) {
      best.set(code, course);
    } else if (isBetter(course, current)) {
      skip(current, "repeated");
      best.set(code, course);
    } else {
      skip(course, "repeated");
    }
  }

  const attempts = new Map<string, Attempt>();
  for (const [code, course] of best) {
    const grade = course.letterGrade.toUpperCase();
    const inProgress = IN_PROGRESS_GRADES.has(grade);
    attempts.set(code, {
      code,
      grade,
      inProgress,
      used: false,
      units: inProgress
        ? toUnits(course.attemptedUnits, course.units)
        : toUnits(course.earnedUnits, course.units),
    });
  }
  return { attempts, notCounted };
}

function buildNode(requirement: ProgramRequirement, nodes: RequirementNode[]): RequirementNode {
  const node: RequirementNode = {
    requirement,
    applied: [],
    children: requirement.children.map((child) => buildNode(child, nodes)),
  };
  nodes.push(node);
  return node;
}

function eligibleAttempts(requirement: ProgramRequirement, attempts: Map<string, Attempt>) {
  return requirement.courses
    .map((code) => attempts.get(normalizeCode(code)))
    .filter((attempt): attempt is Attempt => Boolean(attempt))
    .filter((attempt) => !attempt.used && meetsMinimum(attempt.grade, requirement.min_grade))
    .sort((left, right) => Number(left.inProgress) - Number(right.inProgress));
}

function appliedUnits(node: RequirementNode) {
  return node.applied.reduce((total, attempt) => total + attempt.units, 0);
}

function allocate(nodes: RequirementNode[], attempts: Map<string, Attempt>) {
  // Narrow requirements go first so a broad pool can't use a course they need.
  const ordered = [...nodes].sort((left, right) => {
    const rule = ALLOCATION_ORDER[left.requirement.rule] - ALLOCATION_ORDER[right.requirement.rule];
    return rule || left.requirement.courses.length - right.requirement.courses.length;
  });

  for (const node of ordered) {
    const { rule, units } = node.requirement;
    const target = rule === "all_of" ? null : units;
    for (const attempt of eligibleAttempts(node.requirement, attempts)) {
      if (target !== null && appliedUnits(node) >= target) {
        break;
      }
      attempt.used = true;
      node.applied.push(attempt);
    }
  }

  // Excess units still show on a choose_units pool once nothing else needs them.
  for (const node of ordered) {
    if (node.requirement.rule === "choose_units") {
      for (const attempt of eligibleAttempts(node.requirement, attempts)) {
        attempt.used = true;
        node.applied.push(attempt);
      }
    }
  }
}

function courseStatus(completed: number, inProgress: number, required: number | null): AuditStatus {
  if (required === null) {
    return "manual_check";
  }
  if (completed >= required) {
    return "met";
  }
  return completed + inProgress >= required ? "in_progress" : "unmet";
}

function allOfStatus(missing: string[], inProgress: boolean, children: RequirementResult[]): AuditStatus {
  if (missing.length > 0 || children.some((child) => child.status === "unmet")) {
    return "unmet";
  }
  if (children.some((child) => child.status === "manual_check")) {
    return "manual_check";
  }
  return inProgress || children.some((child) => child.status === "in_progress") ? "in_progress" : "met";
}

function evaluate(node: RequirementNode): RequirementResult {
  const { requirement } = node;
  const children = node.children.map(evaluate);
  const appliedCourses = node.applied.map(({ code, units, grade, inProgress }) => ({ code, units, grade, inProgress }));
  const sumUnits = (key: "unitsCompleted" | "unitsInProgress") =>
    children.reduce((total, child) => {
      const limit = child.unitsRequired;
      return total + (limit === null ? child[key] : Math.min(child[key], limit));
    }, 0);
  const ownCompleted = appliedCourses.filter((course) => !course.inProgress).reduce((total, course) => total + course.units, 0);
  const ownInProgress = appliedCourses.filter((course) => course.inProgress).reduce((total, course) => total + course.units, 0);
  const unitsCompleted = ownCompleted + sumUnits("unitsCompleted");
  const unitsInProgress = ownInProgress + sumUnits("unitsInProgress");
  const applied = new Set(appliedCourses.map((course) => course.code));
  const notApplied = requirement.courses.filter((code) => !applied.has(normalizeCode(code)));
  const missingCourses = requirement.rule === "all_of" ? notApplied : [];
  const otherListedCourses = requirement.rule === "all_of" ? [] : notApplied;

  let status: AuditStatus;
  if (requirement.rule === "all_of") {
    status = allOfStatus(missingCourses, ownInProgress > 0, children);
  } else if (requirement.rule === "choose_units" || requirement.rule === "choose_courses") {
    status = courseStatus(unitsCompleted, unitsInProgress, requirement.units);
  } else {
    status = "manual_check";
  }

  return {
    title: requirement.title,
    rule: requirement.rule,
    status,
    unitsRequired: requirement.units,
    unitsCompleted,
    unitsInProgress,
    unitsNeeded: requirement.units === null ? null : Math.max(0, requirement.units - unitsCompleted - unitsInProgress),
    appliedCourses,
    missingCourses,
    otherListedCourses,
    sourceText: requirement.source_text,
    children,
  };
}

export function auditDegree(
  program: DegreeProgram,
  transcriptCourses: TranscriptCourse[],
  externalUnits = 0,
): AuditResult {
  const { attempts, notCounted } = selectAttempts(transcriptCourses);
  const nodes: RequirementNode[] = [];
  const roots = program.requirements.map((requirement) => buildNode(requirement, nodes));
  allocate(nodes, attempts);

  const all = [...attempts.values()];
  const completed = externalUnits + all.filter((item) => !item.inProgress).reduce((total, item) => total + item.units, 0);
  const inProgress = all.filter((item) => item.inProgress).reduce((total, item) => total + item.units, 0);
  const required = program.total_units;

  return {
    programName: program.name,
    catalogId: program.catalog_id,
    sourceUrl: program.source_url,
    totalUnits: {
      required,
      completed,
      inProgress,
      needed: required === null ? null : Math.max(0, required - completed - inProgress),
    },
    externalUnits,
    requirements: roots.map(evaluate),
    unmatchedCourses: all
      .filter((item) => !item.used)
      .map(({ code, units, grade, inProgress: active }) => ({ code, units, grade, inProgress: active })),
    notCountedCourses: notCounted,
  };
}
