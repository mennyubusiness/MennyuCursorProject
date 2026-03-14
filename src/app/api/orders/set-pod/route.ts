/**
 * GET /api/orders/set-pod?podId=...&next=/cart
 * Sets current-pod cookie and redirects to next (e.g. /cart) so the cart page shows the right pod.
 * Used after reorder to land on cart for the reordered pod.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildCurrentPodCookieHeader } from "@/lib/session";

export async function GET(request: NextRequest) {
  const podId = request.nextUrl.searchParams.get("podId");
  const next = request.nextUrl.searchParams.get("next") ?? "/cart";
  if (!podId) {
    return NextResponse.redirect(new URL("/orders", request.url), 303);
  }

  const url = next.startsWith("/") ? new URL(next, request.url) : new URL("/cart", request.url);
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Set-Cookie", buildCurrentPodCookieHeader(podId));
  return res;
}
