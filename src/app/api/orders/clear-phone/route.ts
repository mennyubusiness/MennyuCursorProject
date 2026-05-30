/**
 * POST /api/orders/clear-phone
 * Clears the legacy mennyu_customer_phone cookie (order access bootstrap).
 */
import { NextResponse } from "next/server";
import { buildClearCustomerPhoneCookieHeader } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCustomerPhoneCookieHeader());
  return res;
}
