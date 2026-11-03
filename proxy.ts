import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";
import { isLocalPreview } from "@/utils/preview";

export async function proxy(request: NextRequest) {
  if (isLocalPreview()) {
    // Block all server-action/mutation entry points, including direct requests.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return new NextResponse("Remote actions are disabled in Local demo preview.", { status: 403 });
    }
    if (request.nextUrl.pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const response = NextResponse.next({ request });
    // Defense in depth: the browser may connect only to this local application.
    response.headers.set("Content-Security-Policy", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*; form-action 'self'");
    return response;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
