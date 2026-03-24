/**
 * POST /api/orders/clear-phone
 * Clears the customer phone cookie (order history session).
 */
import { NextResponse } from "next/server";
import { buildClearCustomerPhoneCookieHeader } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCustomerPhoneCookieHeader());
  return res;
}
