"use client";

import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "sign-in" | "sign-up";

const initialState: AuthState = { error: null, message: null };

const fieldClassName =
  "mt-1 h-9 w-full rounded-md border border-neutral-200 px-2 text-sm text-neutral-900";

export function AuthDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingOpen = useRef(false);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const callbackError = useSearchParams().get("auth_error");

  useEffect(() => {
    if (pendingOpen.current) {
      pendingOpen.current = false;
      dialogRef.current?.showModal();
    }
  }, [mode]);

  useEffect(() => {
    if (callbackError) {
      dialogRef.current?.showModal();
    }
  }, [callbackError]);

  function open(next: AuthMode) {
    if (mode === next) {
      dialogRef.current?.showModal();
      return;
    }

    pendingOpen.current = true;
    setMode(next);
  }

  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  async function continueWithGoogle() {
    setGoogleError(null);
    setGooglePending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: "sjsu.edu",
        },
      },
    });

    if (error) {
      setGoogleError(error.message);
      setGooglePending(false);
    }
  }

  const title = mode === "sign-in" ? "Sign in" : "Sign up";

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => open("sign-in")}
          className="h-8 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => open("sign-up")}
          className="h-8 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Sign up
        </button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="auth-dialog-title"
        onClick={closeOnBackdropClick}
        className="fixed inset-0 m-auto h-fit w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="auth-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="inline-flex size-6 shrink-0 items-center justify-center text-lg leading-none font-semibold text-neutral-900 hover:text-neutral-600"
          >
            ×
          </button>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={googlePending}
            className="h-9 w-full rounded-md border border-neutral-200 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            {googlePending ? "Redirecting…" : "Continue with Google"}
          </button>
          {googleError ? (
            <p className="mt-2 text-sm text-red-600">{googleError}</p>
          ) : null}
          <p className="mt-3 text-center text-xs text-neutral-500">or</p>
        </div>
        {mode === "sign-in" ? (
          <AuthForm
            key="sign-in"
            mode="sign-in"
            action={signIn}
            callbackError={callbackError}
            onSwitch={() => setMode("sign-up")}
          />
        ) : (
          <AuthForm
            key="sign-up"
            mode="sign-up"
            action={signUp}
            callbackError={callbackError}
            onSwitch={() => setMode("sign-in")}
          />
        )}
      </dialog>
    </>
  );
}

function AuthForm({
  mode,
  action,
  callbackError,
  onSwitch,
}: {
  mode: AuthMode;
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  callbackError: string | null;
  onSwitch: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const error = state.error ?? callbackError;
  const submitLabel = mode === "sign-in" ? "Sign in" : "Sign up";

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <div>
        <label htmlFor={`${mode}-email`} className="text-sm font-medium">
          {mode === "sign-up" ? "SJSU email" : "Email"}
        </label>
        <input
          id={`${mode}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={mode === "sign-up" ? "name@sjsu.edu" : undefined}
          className={fieldClassName}
        />
        {mode === "sign-up" ? (
          <p className="mt-1 text-xs text-neutral-500">
            Use your @sjsu.edu address.
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${mode}-password`} className="text-sm font-medium">
          Password
        </label>
        <input
          id={`${mode}-password`}
          name="password"
          type="password"
          required
          minLength={mode === "sign-up" ? 6 : undefined}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className={fieldClassName}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {state.message ? (
        <p className="text-sm text-neutral-600">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="text-sm text-neutral-600 hover:text-neutral-900"
      >
        {mode === "sign-in"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
