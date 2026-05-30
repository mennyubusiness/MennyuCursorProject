import { NextRequest, NextResponse } from "next/server";
import {
  buildClearCustomerSessionCookieHeader,
  revokeCustomerSessionFromRequest,
} from "@/lib/customer-session";

/**
 * POST /api/customer/session/clear
 * Clears verified checkout phone session (mennyu_customer) on this device.
 * Idempotent: missing, expired, or already-revoked sessions still return ok.
 */
export async function POST(request: NextRequest) {
  await revokeCustomerSessionFromRequest(request);

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCustomerSessionCookieHeader());
  return res;
}
