"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSjsuEmail } from "@/utils/auth/sjsuEmail";
import { clearDevSignOut, rememberDevSignOut } from "@/utils/supabase/devSession";
import { createClient } from "@/utils/supabase/server";

export type AuthState = {
  error: string | null;
  message: string | null;
};

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = credentials(formData);

  if (!email.includes("@") || !password) {
    return { error: "Enter your email and password.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null };
  }

  await clearDevSignOut();
  redirect("/");
}

export async function signUp(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = credentials(formData);

  if (!isSjsuEmail(email)) {
    return { error: "Use your SJSU email address (@sjsu.edu).", message: null };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", message: null };
  }

  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    `http://${headerStore.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message, message: null };
  }

  if (data.session) {
    await clearDevSignOut();
    redirect("/");
  }

  return {
    error: null,
    message: "Check your email to confirm your account.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await rememberDevSignOut();
  redirect("/");
}
