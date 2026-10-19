import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isDevelopmentMode } from "@/utils/supabase/env";

const loggedMessages = new Set<string>();

function logOnce(level: "log" | "warn" | "error", message: string) {
  if (loggedMessages.has(message)) {
    return;
  }

  loggedMessages.add(message);
  console[level](message);
}

function errorDetail(error: unknown) {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (current.message) {
      parts.push(current.message);
    }
    if ("code" in current && current.code) {
      parts.push(String(current.code));
    }
    if ("hostname" in current && current.hostname) {
      parts.push(String(current.hostname));
    }
    current = current.cause;
  }

  return [...new Set(parts)].join(": ") || "Unknown error";
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  if (!env) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      if (isDevelopmentMode()) {
        logOnce("log", `Signed in. Auth id: ${data.user.id}`);
      }
      return supabaseResponse;
    }

    if (!isDevelopmentMode()) {
      return supabaseResponse;
    }

    const email = process.env.DEV_TEST_EMAIL;
    const password = process.env.DEV_TEST_PASSWORD;

    if (!email || !password) {
      logOnce(
        "warn",
        "DEVELOPMENT_MODE is true, but DEV_TEST_EMAIL or DEV_TEST_PASSWORD is missing.",
      );
      return supabaseResponse;
    }

    const { data: signedIn, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logOnce("error", `Dev test account sign-in failed: ${errorDetail(error)}`);
    } else {
      logOnce("log", `Signed in. Auth id: ${signedIn.user?.id ?? "unknown"}`);
    }
  } catch (error) {
    logOnce("error", `Supabase session check failed: ${errorDetail(error)}`);
  }

  return supabaseResponse;
}
