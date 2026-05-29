import { NextRequest, NextResponse } from "next/server";
import {
  buildPersistedCustomerOrderAccessCookieHeaders,
  resolveCustomerOrderAccessBootstrap,
} from "@/lib/customer-order-access";

function buildOrderPageRedirectUrl(
  request: NextRequest,
  orderId: string,
  params: { from?: string | null; payment?: string | null }
): URL {
  const url = new URL(`/order/${orderId}`, request.url);
  if (params.from?.trim()) url.searchParams.set("from", params.from.trim());
  if (params.payment?.trim()) url.searchParams.set("payment", params.payment.trim());
  return url;
}

/**
 * GET /api/orders/[orderId]/access?access={signedToken}
 * Validates signed order access links (SMS, checkout return) and sets HttpOnly cookies via redirect.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  const access = request.nextUrl.searchParams.get("access")?.trim();
  const from = request.nextUrl.searchParams.get("from");
  const payment = request.nextUrl.searchParams.get("payment");
  const redirectTarget = buildOrderPageRedirectUrl(request, orderId, { from, payment });

  if (!access) {
    return NextResponse.redirect(redirectTarget, 302);
  }

  const resolved = await resolveCustomerOrderAccessBootstrap(orderId, access);
  if (!resolved.ok) {
    return NextResponse.redirect(redirectTarget, 302);
  }

  const response = NextResponse.redirect(redirectTarget, 302);
  for (const header of buildPersistedCustomerOrderAccessCookieHeaders(access, resolved.customerPhone)) {
    response.headers.append("Set-Cookie", header);
  }
  return response;
}
