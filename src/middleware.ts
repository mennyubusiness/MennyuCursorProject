import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  SESSION_HEADER,
  buildSessionCookieHeader,
  buildCurrentPodCookieHeader,
  createMennyuSessionId,
} from "@/lib/session";

export function middleware(request: NextRequest) {
  let response: NextResponse;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const sessionCookie = request.cookies.get(COOKIE_NAME);
  const existingSession = sessionCookie?.value?.trim();
  if (existingSession) {
    /* Echo cookie into request header so RSC / Server Actions always see a stable id even if
     * Cookie parsing via headers().get("cookie") is flaky for this request. */
    requestHeaders.set(SESSION_HEADER, existingSession);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const sessionId = createMennyuSessionId();
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
