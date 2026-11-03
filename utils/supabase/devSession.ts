import { cookies } from "next/headers";
import { devSignedOutCookie, isDevelopmentMode } from "@/utils/supabase/env";

export async function rememberDevSignOut() {
  if (!isDevelopmentMode()) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(devSignedOutCookie, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function clearDevSignOut() {
  if (!isDevelopmentMode()) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.delete(devSignedOutCookie);
}
