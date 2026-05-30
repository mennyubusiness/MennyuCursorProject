/**
 * POST /api/order/[orderId]/cancel
 * @deprecated Direct customer cancellation is disabled. Use the order help form (cancel_request).
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { customerCancelUnsupportedResponse } from "@/lib/customer-cancel-api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const access = await assertCustomerOrderAccess(orderId, await headers());
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return customerCancelUnsupportedResponse();
}
