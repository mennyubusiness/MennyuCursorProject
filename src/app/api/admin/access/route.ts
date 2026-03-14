/**
 * POST body: { secret: string }
 * If secret matches ADMIN_SECRET, sets cookie and redirects to /admin.
 * TODO: Replace with proper auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildAdminCookieHeader } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  if (env.NODE_ENV === "development") {
    const res = NextResponse.redirect(new URL("/admin", request.url), 303);
    res.headers.set("Set-Cookie", buildAdminCookieHeader("dev"));
    return res;
  }
  const secret = env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  let body: { secret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (body.secret?.trim() !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }
  const res = NextResponse.redirect(new URL("/admin", request.url), 303);
  res.headers.set("Set-Cookie", buildAdminCookieHeader(secret));
  return res;
}
