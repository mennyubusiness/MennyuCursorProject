/**
 * POST /api/orders/set-phone
 * Body: { phone: string }
 * Sets customer phone cookie for order history, then redirects to /orders.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildCustomerPhoneCookieHeader } from "@/lib/session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phone =
    body && typeof body === "object" && "phone" in body && typeof (body as { phone: unknown }).phone === "string"
      ? (body as { phone: string }).phone.trim()
      : null;
  if (!phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  const res = NextResponse.redirect(new URL("/orders", request.url), 303);
  res.headers.set("Set-Cookie", buildCustomerPhoneCookieHeader(phone));
  return res;
}
