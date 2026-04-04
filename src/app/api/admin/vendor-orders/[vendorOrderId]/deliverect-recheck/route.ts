/**
 * POST: Re-check Deliverect for a vendor order (reconciliation fallback via GET order API).
 */
import { NextRequest, NextResponse } from "next/server";
import { attemptDeliverectReconciliationFallback } from "@/services/deliverect-reconciliation-fallback.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ ok: false, error: "Missing vendorOrderId" }, { status: 400 });
  }

  let onlyIfOverdue = false;
  let allowAfterManualRecovery = false;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object") {
      if (typeof (body as { onlyIfOverdue?: unknown }).onlyIfOverdue === "boolean") {
        onlyIfOverdue = (body as { onlyIfOverdue: boolean }).onlyIfOverdue;
      }
      if (typeof (body as { allowAfterManualRecovery?: unknown }).allowAfterManualRecovery === "boolean") {
        allowAfterManualRecovery = (body as { allowAfterManualRecovery: boolean }).allowAfterManualRecovery;
      }
    }
  } catch {
    /* empty body */
  }

  const result = await attemptDeliverectReconciliationFallback(vendorOrderId, {
    onlyIfOverdue,
    allowAfterManualRecovery,
  });

  switch (result.outcome) {
    case "applied":
      return NextResponse.json({
        ok: true,
        result: "success",
        message: "Matched Deliverect order and applied status",
        lookupDeliverectOrderId: result.lookupDeliverectOrderId,
        deliverectWebhookApplyOutcome: result.deliverectWebhookApplyOutcome,
        updatedVendorOrderState: result.updatedVendorOrderState,
      });
    case "noop":
      return NextResponse.json({
        ok: true,
        result: "noop",
        message: "Deliverect order found; no state change needed",
        deliverectWebhookApplyOutcome: result.deliverectWebhookApplyOutcome,
      });
    case "no_match":
      return NextResponse.json({
        ok: true,
        result: "no_match",
        message: "Could not load or match Deliverect order",
        reason: result.reason,
        lookupDeliverectOrderId: result.lookupDeliverectOrderId,
      });
    case "ambiguous":
      return NextResponse.json({
        ok: true,
        result: "ambiguous",
        message: "Deliverect response did not safely match this vendor order",
        reason: result.reason,
      });
    case "not_eligible":
      return NextResponse.json({
        ok: false,
        result: "not_eligible",
        message: "Vendor order is not eligible for Deliverect re-check",
        reason: result.reason,
      });
    default: {
      const _exhaustive: never = result;
      return NextResponse.json({ ok: false, error: "unknown", detail: _exhaustive }, { status: 500 });
    }
  }
}
