"use client";

import { useState } from "react";

const tabs = ["Main", "Calendar"] as const;

type Tab = (typeof tabs)[number];

export function SyllabusTracker() {
  const [tab, setTab] = useState<Tab>("Main");

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <div
        role="tablist"
        aria-label="Syllabus tracker"
        className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm"
      >
        {tabs.map((name) => {
          const selected = tab === name;

          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(name)}
              className={
                selected
                  ? "rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              }
            >
              {name}
            </button>
          );
        })}
      </div>
    </main>
  );
}
