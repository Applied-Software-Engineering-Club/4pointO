import { NextResponse } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { isSjsuEmail } from "@/utils/auth/sjsuEmail";
import { clearDevSignOut, rememberDevSignOut } from "@/utils/supabase/devSession";
import { createClient } from "@/utils/supabase/server";

const emailOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change",
]);

function rejectedGoogleAccount(user: User) {
  if (user.app_metadata?.provider !== "google") {
    return null;
  }

  const identity = user.identities?.find((item) => item.provider === "google");
  const email = String(identity?.identity_data?.email ?? user.email ?? "");
  const verified =
    identity?.identity_data?.email_verified === true ||
    Boolean(user.email_confirmed_at);

  if (verified && isSjsuEmail(email)) {
    return null;
  }

  return "Use your SJSU Google account (@sjsu.edu).";
}

function nextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = nextPath(url.searchParams.get("next"));
  const callbackError = url.searchParams.get("error_description");

  if (callbackError) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(callbackError)}`, url.origin),
    );
  }

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const rejection = rejectedGoogleAccount(data.user);
      if (rejection) {
        await supabase.auth.signOut();
        await rememberDevSignOut();
        return NextResponse.redirect(
          new URL(`/?auth_error=${encodeURIComponent(rejection)}`, url.origin),
        );
      }

      await clearDevSignOut();
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  if (tokenHash && type && emailOtpTypes.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    if (!error) {
      await clearDevSignOut();
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/?auth_error=Could+not+confirm+sign-up", url.origin),
  );
}
