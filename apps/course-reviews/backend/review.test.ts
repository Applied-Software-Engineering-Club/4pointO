import { describe, expect, it } from "vitest";
import { reviewFromRow } from "./review";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  professor: "Ada Lovelace",
  course: "CS 146",
  up_count: 1,
  down_count: 0,
  would_take_again: true,
  message: "Clear lectures.",
  tags: ["Clear lectures"],
  hours_per_week: 6,
  difficulty: 3,
  grade: "A",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
};

describe("reviewFromRow", () => {
  it("does not copy the author id onto the review", () => {
    const review = reviewFromRow(row);

    expect(review?.professor).toBe("Ada Lovelace");
    expect(review).not.toHaveProperty("userId");
    expect(JSON.stringify(review)).not.toContain(row.user_id);
  });
});
