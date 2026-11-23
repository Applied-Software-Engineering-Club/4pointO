export const reviewColumns = [
  "id",
  "user_id",
  "professor",
  "course",
  "up_count",
  "down_count",
  "would_take_again",
  "message",
  "tags",
  "hours_per_week",
  "difficulty",
  "grade",
  "created_at",
  "updated_at",
].join(", ");

/** SJSU letter grades that map onto the 4.0 scale for averages. */
export const REVIEW_LETTER_GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
] as const;

export type ReviewLetterGrade = (typeof REVIEW_LETTER_GRADES)[number];

export type ReviewDraft = {
  professor: string;
  course: string;
  wouldTakeAgain: boolean;
  message: string;
  tags: string[];
  hoursPerWeek: number;
  difficulty: number | null;
  grade: ReviewLetterGrade | null;
};

export type CourseReview = ReviewDraft & {
  id: string;
  userId: string;
  upCount: number;
  downCount: number;
  createdAt: string;
  updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeReviewText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForLanguageCheck(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]+/g, "");
}

// This is a conservative application-level guard. The database remains the
// source of truth for authorization and row constraints.
const EXPLICIT_LANGUAGE = [
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "faggot",
  "fuck",
  "nigger",
  "piss",
  "shit",
  "slut",
  "whore",
];

export function containsExplicitLanguage(value: string) {
  const normalized = normalizeForLanguageCheck(value);
  return EXPLICIT_LANGUAGE.some((term) => normalized.includes(term));
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new Error(`${field} is required.`);
  }

  const normalized = normalizeReviewText(value);
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

function tags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => normalizeReviewText(tag))
    .filter(Boolean);
}

function wholeNumber(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} is invalid.`);
  }

  return value;
}

export function validateReviewDraft(input: ReviewDraft): ReviewDraft {
  const professor = requiredText(input.professor, "Professor", 120);
  const course = requiredText(input.course, "Course", 120);
  const message = requiredText(input.message, "Review", 500);
  if (containsExplicitLanguage(message)) {
    throw new Error("Please remove explicit language from your review.");
  }

  const normalizedTags = tags(input.tags);
  if (normalizedTags.length > 8 || new Set(normalizedTags).size !== normalizedTags.length) {
    throw new Error("Reviews may contain up to 8 unique tags.");
  }

  if (typeof input.wouldTakeAgain !== "boolean") {
    throw new Error("Choose whether you would take this course again.");
  }

  const difficulty =
    input.difficulty == null ? null : wholeNumber(input.difficulty, "Difficulty", 1, 5);

  const grade = letterGrade(input.grade);

  return {
    professor,
    course,
    wouldTakeAgain: input.wouldTakeAgain,
    message,
    tags: normalizedTags,
    hoursPerWeek: wholeNumber(input.hoursPerWeek, "Hours per week", 0, 40),
    difficulty,
    grade,
  };
}

function letterGrade(value: unknown): ReviewLetterGrade | null {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Grade is invalid.");
  }

  const normalized = value.trim().toUpperCase();
  if (!(REVIEW_LETTER_GRADES as readonly string[]).includes(normalized)) {
    throw new Error("Grade is invalid.");
  }

  return normalized as ReviewLetterGrade;
}

export function reviewFromRow(row: Record<string, unknown>): CourseReview | null {
  const id = typeof row.id === "string" ? row.id : "";
  const userId = typeof row.user_id === "string" ? row.user_id : "";
  const professor = typeof row.professor === "string" ? row.professor : "";
  const course = typeof row.course === "string" ? row.course : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : "";
  if (!UUID.test(id) || !UUID.test(userId) || !professor || !course || !createdAt || !updatedAt) {
    return null;
  }

  const rowTags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const difficulty = row.difficulty == null ? null : Number(row.difficulty);
  if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
    return null;
  }

  let grade: ReviewLetterGrade | null = null;
  if (row.grade != null && row.grade !== "") {
    if (typeof row.grade !== "string") {
      return null;
    }
    const normalized = row.grade.trim().toUpperCase();
    if (!(REVIEW_LETTER_GRADES as readonly string[]).includes(normalized)) {
      return null;
    }
    grade = normalized as ReviewLetterGrade;
  }

  return {
    id,
    userId,
    professor,
    course,
    upCount: Number(row.up_count) || 0,
    downCount: Number(row.down_count) || 0,
    wouldTakeAgain: row.would_take_again === true,
    message: typeof row.message === "string" ? row.message : "",
    tags: rowTags,
    hoursPerWeek: Number(row.hours_per_week) || 0,
    difficulty,
    grade,
    createdAt,
    updatedAt,
  };
}
