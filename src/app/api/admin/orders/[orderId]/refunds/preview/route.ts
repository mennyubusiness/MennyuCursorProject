import { NextResponse } from "next/server";
import { parseAdminRefundRequestBody } from "@/lib/admin-refund-request";
import { resolvePlatformAdminUserIdForRefund } from "@/lib/admin-refund-api-auth";
import { previewAdminRefund } from "@/services/admin-refund.service";

export const dynamic = "force-dynamic";

/** POST: Preview admin refund (no DB mutations, no Stripe). */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const adminUserId = await resolvePlatformAdminUserIdForRefund(request);
  if (!adminUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAdminRefundRequestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const preview = await previewAdminRefund({
    scope: parsed.data.scope,
    orderId,
    vendorOrderId: parsed.data.vendorOrderId,
    amountCents: parsed.data.amountCents,
    reason: parsed.data.reason,
    adminNote: parsed.data.adminNote,
    platformAbsorbsRefund: parsed.data.platformAbsorbsRefund ?? false,
  });

  if (!preview) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ preview });
}
