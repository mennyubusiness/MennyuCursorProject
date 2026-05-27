import { NextResponse } from "next/server";
import { parseAdminRefundRequestBody } from "@/lib/admin-refund-request";
import { resolvePlatformAdminUserIdForRefund } from "@/lib/admin-refund-api-auth";
import {
  AdminRefundError,
  executeAdminCustomVendorOrderRefund,
  executeAdminFullOrderRefund,
  executeAdminFullVendorOrderRefund,
  executeAdminLineItemRefund,
} from "@/services/admin-refund.service";

export const dynamic = "force-dynamic";

/** POST: Execute admin refund for an order. */
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

  const base = {
    orderId,
    adminUserId,
    reason: parsed.data.reason,
    adminNote: parsed.data.adminNote,
    customerVisibleNote: parsed.data.customerVisibleNote,
    linkedOrderIssueId: parsed.data.linkedOrderIssueId,
  };

  try {
    let result;
    switch (parsed.data.scope) {
      case "full_order":
        result = await executeAdminFullOrderRefund(base);
        break;
      case "full_vendor_order":
        result = await executeAdminFullVendorOrderRefund({
          ...base,
          vendorOrderId: parsed.data.vendorOrderId!,
        });
        break;
      case "custom_vendor_partial":
        result = await executeAdminCustomVendorOrderRefund({
          ...base,
          vendorOrderId: parsed.data.vendorOrderId!,
          amountCents: parsed.data.amountCents!,
          platformAbsorbsRefund: parsed.data.platformAbsorbsRefund ?? false,
        });
        break;
      case "line_item_refund":
        result = await executeAdminLineItemRefund({
          ...base,
          vendorOrderId: parsed.data.vendorOrderId!,
          orderLineItemId: parsed.data.orderLineItemId!,
          quantity: parsed.data.quantity!,
          includeTax: parsed.data.includeTax ?? undefined,
          includeTip: parsed.data.includeTip ?? undefined,
          includeServiceFee: parsed.data.includeServiceFee ?? undefined,
          platformAbsorbsRefund: parsed.data.platformAbsorbsRefund ?? false,
        });
        break;
    }

    const status = result.success ? 200 : 502;
    return NextResponse.json(result, { status });
  } catch (e) {
    if (e instanceof AdminRefundError) {
      const status =
        e.code === "FORBIDDEN" ? 403 : e.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          code: e.code,
          message: e.message,
          blockingReasons: e.blockingReasons,
        },
        { status }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
