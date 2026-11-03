"use server";

export async function runTest(previous: string | null): Promise<string> {
  const previousCount = Number.parseInt(
    previous?.match(/Count: (\d+)/)?.[1] ?? "0",
    10,
  );
  const count = previousCount + 1;

  return `Course Planner backend received the test. Count: ${count}.`;
}
