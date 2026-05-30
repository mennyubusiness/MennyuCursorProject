import { NextRequest, NextResponse } from "next/server";
import {
  buildClearCustomerSessionCookieHeader,
  revokeCustomerSessionFromHeaders,
} from "@/lib/customer-session";

/**
 * POST /api/customer/session/clear
 * Clears verified checkout phone session (mennyu_customer) on this device.
 */
export async function POST(request: NextRequest) {
  await revokeCustomerSessionFromHeaders(request.headers);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCustomerSessionCookieHeader());
  return res;
}
