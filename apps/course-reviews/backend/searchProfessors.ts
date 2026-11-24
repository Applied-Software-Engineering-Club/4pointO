"use server";

import professorData from "@/utils/data/professors.json";
import { createClient } from "@/utils/supabase/server";
import { normalizeReviewText } from "./review";

// Temporary hardcoded roster (utils/data/professors.json) until a professors table exists.
// Reviews are SJSU-only today, so only SJSU professors are matched against them.
const REVIEWED_SCHOOL = "SJSU";
const MAX_RESULTS = 10;
const MAX_TERM_LENGTH = 80;

type RosterEntry = { name: string; school: string; schoolShort: string };

export type ProfessorReview = {
  id: string;
  course: string;
  wouldTakeAgain: boolean;
  message: string;
  difficulty: number | null;
};

export type ProfessorResult = {
  name: string;
  school: string;
  reviews: ProfessorReview[];
};

function fold(value: string) {
  return normalizeReviewText(value)
    .slice(0, MAX_TERM_LENGTH)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function searchProfessors(
  nameQuery: string,
  schoolQuery: string,
): Promise<ProfessorResult[]> {
  const name = fold(nameQuery);
  const school = fold(schoolQuery);
  if (!name) {
    return [];
  }

  const matches = (professorData as RosterEntry[])
    .filter(
      (entry) =>
        fold(entry.name).includes(name) &&
        (!school ||
          fold(entry.school).includes(school) ||
          fold(entry.schoolShort).includes(school)),
    )
    .slice(0, MAX_RESULTS);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return Promise.all(
    matches.map(async (entry): Promise<ProfessorResult> => {
      const result = { name: entry.name, school: entry.school, reviews: [] as ProfessorReview[] };
      if (!auth.user || entry.schoolShort !== REVIEWED_SCHOOL) {
        return result;
      }

      const { data, error } = await supabase
        .from("reviews")
        .select("id, course, would_take_again, message, difficulty")
        .ilike("professor", escapeIlike(entry.name))
        .order("created_at", { ascending: false });

      if (error || !Array.isArray(data)) {
        throw new Error("Couldn't search professors.");
      }

      result.reviews = data.flatMap((row) =>
        typeof row.id === "string" && typeof row.course === "string"
          ? [
              {
                id: row.id,
                course: row.course,
                wouldTakeAgain: row.would_take_again === true,
                message: typeof row.message === "string" ? row.message : "",
                difficulty:
                  Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 5
                    ? (row.difficulty as number)
                    : null,
              },
            ]
          : [],
      );
      return result;
    }),
  );
}
