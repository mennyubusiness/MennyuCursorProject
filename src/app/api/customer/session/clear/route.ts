import { NextRequest, NextResponse } from "next/server";
import {
  buildClearCustomerSessionCookieHeader,
  revokeCustomerSessionFromHeaders,
} from "@/lib/customer-session";

/**
 * POST /api/customer/session/clear
 * Signs out of verified customer identity (order history / reorder ownership).
 */
export async function POST(request: NextRequest) {
  await revokeCustomerSessionFromHeaders(request.headers);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCustomerSessionCookieHeader());
  return res;
}
