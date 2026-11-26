"use client";

import { useEffect, useState } from "react";
import { listReviews } from "@/apps/course-reviews/backend/listReviews";
import type { CourseReview } from "@/apps/course-reviews/backend/review";

const gradePoints: Record<string, number> = {
  "A+": 4, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7,
  "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7, F: 0,
};

function mean(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function closestGrade(points: number) {
  let best = "F";
  for (const [grade, value] of Object.entries(gradePoints)) {
    if (grade === "A+") continue;
    if (Math.abs(value - points) < Math.abs(gradePoints[best] - points)) {
      best = grade;
    }
  }
  return best;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Summary({ reviews }: { reviews: CourseReview[] }) {
  const difficulty = mean(reviews.flatMap((r) => (r.difficulty === null ? [] : [r.difficulty])));
  const hours = mean(reviews.map((r) => r.hoursPerWeek));
  const grade = mean(reviews.flatMap((r) => (r.grade === null ? [] : [gradePoints[r.grade]])));
  const takeAgain = Math.round(
    (reviews.filter((r) => r.wouldTakeAgain).length / reviews.length) * 100,
  );

  const items = [
    { label: "Difficulty", value: difficulty === null ? "—" : `${difficulty.toFixed(1)} / 5` },
    { label: "Would take again", value: `${takeAgain}%` },
    { label: "Avg grade", value: grade === null ? "—" : closestGrade(grade) },
    { label: "Hours / week", value: hours === null ? "—" : `~${Math.round(hours)}` },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-neutral-200 bg-white p-2">
          <dt className="text-xs text-neutral-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewCard({ review }: { review: CourseReview }) {
  const details = [
    review.grade ? `Grade: ${review.grade}` : null,
    review.difficulty !== null ? `Difficulty ${review.difficulty}/5` : null,
    `${review.hoursPerWeek} hrs/week`,
  ].filter(Boolean);

  return (
    <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">{details.join(" · ")}</p>
        <p
          className={`text-xs font-medium ${
            review.wouldTakeAgain ? "text-green-700" : "text-neutral-500"
          }`}
        >
          {review.wouldTakeAgain ? "Would take again" : "Would not take again"}
        </p>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap text-neutral-700">{review.message}</p>
      {review.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {review.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          <span aria-label={`${review.upCount} helpful`}>▲ {review.upCount}</span>
          <span className="ml-3" aria-label={`${review.downCount} not helpful`}>
            ▼ {review.downCount}
          </span>
        </span>
        <span>{formatDate(review.createdAt)}</span>
      </div>
    </li>
  );
}

export function CourseReviews({ professor, courses }: { professor: string; courses: string[] }) {
  const [course, setCourse] = useState(courses[0] ?? "");
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!course) {
      return;
    }
    let active = true;
    setStatus("loading");
    listReviews(professor, course)
      .then((loaded) => {
        if (active) {
          setReviews(loaded);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [professor, course]);

  if (courses.length === 0) {
    return <p className="mt-4 text-sm text-neutral-500">No reviews yet</p>;
  }

  return (
    <div className="mt-4 flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Course">
        {courses.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={course === name}
            onClick={() => setCourse(name)}
            className={
              course === name
                ? "rounded-lg border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 hover:bg-neutral-50"
            }
          >
            {name}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="flex min-h-0 flex-col gap-3">
        {status === "loading" ? <p className="text-sm text-neutral-500">Loading reviews…</p> : null}
        {status === "error" ? (
          <p className="text-sm text-red-700">{"Couldn't load reviews."}</p>
        ) : null}
        {status === "ready" && reviews.length === 0 ? (
          <p className="text-sm text-neutral-500">No reviews for this course yet</p>
        ) : null}
        {status === "ready" && reviews.length > 0 ? (
          <>
            <Summary reviews={reviews} />
            <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}