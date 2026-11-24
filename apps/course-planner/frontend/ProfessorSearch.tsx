"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  searchProfessors,
  type ProfessorResult,
} from "@/apps/course-reviews/backend/searchProfessors";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm font-normal text-neutral-900 outline-none";

function averageRating(reviews: ProfessorResult["reviews"]) {
  const values = reviews.flatMap((review) => (review.difficulty === null ? [] : [review.difficulty]));
  return values.length === 0
    ? null
    : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function ProfessorSearch() {
  const [name, setName] = useState("");
  const [school, setSchool] = useState("SJSU");
  const [results, setResults] = useState<ProfessorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProfessorResult | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openProfessor(professor: ProfessorResult) {
    setSelected(professor);
    dialogRef.current?.showModal();
  }

  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setError(null);
    setLoading(true);

    try {
      setResults(await searchProfessors(name, school));
    } catch {
      setResults([]);
      setError("Couldn't search professors.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={runSearch}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              className="block text-sm font-medium text-neutral-900"
              htmlFor="professor-search"
            >
              Professor
            </label>
            <input
              id="professor-search"
              type="search"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter professor name."
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-neutral-900"
              htmlFor="professor-school"
            >
              School
            </label>
            <input
              id="professor-school"
              type="text"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              placeholder="Enter school."
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-3 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
        >
          Search professors
        </button>
      </form>

      <div className="mt-4" aria-live="polite">
        {!hasSearched ? null : loading ? (
          <p className="text-sm text-neutral-500">Loading</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-neutral-500">No professors found</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((professor) => (
              <li key={`${professor.school}-${professor.name}`}>
                <button
                  type="button"
                  onClick={() => openProfessor(professor)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left hover:bg-neutral-100"
                >
                  <p className="text-sm font-medium">{professor.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{professor.school}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {professor.reviews.length === 0
                      ? "No reviews yet"
                      : `${professor.reviews.length} ${professor.reviews.length === 1 ? "review" : "reviews"}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <dialog
        ref={dialogRef}
        aria-label="Professor reviews"
        onClick={closeOnBackdropClick}
        className="fixed inset-0 m-auto max-h-[80vh] w-full max-w-lg flex-col rounded-2xl open:flex border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{selected?.name}</h2>
            <p className="mt-1 text-xs text-neutral-500">{selected?.school}</p>
            {selected ? (
              <p className="mt-1 text-xs font-medium text-neutral-900">
                {selected.reviews.length} {selected.reviews.length === 1 ? "review" : "reviews"}
                {" · "}
                {averageRating(selected.reviews) === null
                  ? "No ratings yet"
                  : `★ ${averageRating(selected.reviews)} / 5`}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-neutral-900 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
        {selected && selected.reviews.length > 0 ? (
          <ul className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
            {selected.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
              >
                <p className="text-xs font-medium text-neutral-900">
                  {review.course}
                  <span className="ml-2 font-normal text-neutral-500">
                    {review.wouldTakeAgain ? "Would take again" : "Would not take again"}
                  </span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-neutral-600">
                  {review.message}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">No reviews yet</p>
        )}
        <form
          className="mt-4 shrink-0"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="sr-only" htmlFor="professor-review-draft">
            Write a review
          </label>
          <textarea
            id="professor-review-draft"
            rows={3}
            placeholder="Write a review"
            className="w-full resize-none rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm font-normal text-neutral-900 outline-none"
          />
          <button
            type="submit"
            className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Submit
          </button>
        </form>
      </dialog>
    </div>
  );
}
