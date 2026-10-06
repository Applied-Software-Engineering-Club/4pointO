"use client";

import { useActionState } from "react";
import { runTest } from "@/apps/example/backend";

export function ExampleApp() {
  const [message, submit, pending] = useActionState(runTest, null);

  return (
    <main className="flex-1 bg-white px-6 py-6">
      <form action={submit}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-base font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          Test
        </button>
      </form>
      {message ? <p className="mt-4 text-neutral-900">{message}</p> : null}
    </main>
  );
}
