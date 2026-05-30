import { NextRequest, NextResponse } from "next/server";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { ORDER_ACCESS_QUERY_PARAM } from "@/lib/customer-order-access-token";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";
import { getSessionIdFromRequest } from "@/lib/session";
import { getCustomerOrderStatusPollSnapshot } from "@/services/order-status.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const actorKey = getSessionIdFromRequest(request) ?? getClientIp(request);
  const limited = applyRateLimits([
    {
      key: rateLimitKeys.orderStatusPoll(orderId, actorKey),
      ...RATE_LIMITS.orderStatusPoll,
    },
  ]);
  if (limited) return limited;

  const accessToken = new URL(request.url).searchParams.get(ORDER_ACCESS_QUERY_PARAM);
  const access = await assertCustomerOrderAccess(orderId, request.headers, accessToken);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const order = await getCustomerOrderStatusPollSnapshot(orderId);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(order, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
