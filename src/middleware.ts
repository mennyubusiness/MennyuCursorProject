import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  SESSION_HEADER,
  buildSessionCookieHeader,
  buildCurrentPodCookieHeader,
} from "@/lib/session";

export function middleware(request: NextRequest) {
  let response: NextResponse;
  const sessionCookie = request.cookies.get(COOKIE_NAME);
  if (sessionCookie?.value) {
    response = NextResponse.next();
  } else {
    const sessionId = crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SESSION_HEADER, sessionId);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Set-Cookie", buildSessionCookieHeader(sessionId));
  }
  const podMatch = request.nextUrl.pathname.match(/^\/pod\/([^/]+)/);
  if (podMatch) {
    response.headers.append("Set-Cookie", buildCurrentPodCookieHeader(podMatch[1]));
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)"],
};
