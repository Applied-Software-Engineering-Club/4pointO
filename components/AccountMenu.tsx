"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export function AccountMenu({
  avatarUrl,
  email,
}: {
  avatarUrl: string | null;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-neutral-700"
      >
        {avatarUrl ? (
          // Google profile photos come from a different host for each account.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <AccountIcon />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
        >
          {email ? (
            <p className="truncate px-3 py-2 text-sm text-neutral-600" title={email}>
              {email}
            </p>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" />
    </svg>
  );
}
