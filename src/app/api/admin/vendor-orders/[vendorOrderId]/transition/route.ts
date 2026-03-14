/**
 * POST body: { targetState: string }
 * Applies vendor order transition via existing applyVendorOrderTransition with source "admin".
 */
import { NextResponse } from "next/server";
import { applyVendorOrderTransition } from "@/services/order-status.service";
import type { VendorOrderTargetState } from "@/domain/vendor-order-transition";

const ALLOWED: VendorOrderTargetState[] = [
  "sent",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
  "failed",
];

export async function POST(
  _request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ error: "Missing vendorOrderId" }, { status: 400 });
  }

  let body: { targetState?: string };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const targetState = body?.targetState?.trim();
  if (!targetState || !ALLOWED.includes(targetState as VendorOrderTargetState)) {
    return NextResponse.json(
      { error: `Invalid targetState. Allowed: ${ALLOWED.join(", ")}` },
      { status: 400 }
    );
  }

  const result = await applyVendorOrderTransition(
    vendorOrderId,
    targetState as VendorOrderTargetState,
    "admin"
  );

  if (result.success) {
    if (result.fulfillmentStatus === "cancelled") {
      const { createVendorOrderIssue } = await import("@/services/issues.service");
      await createVendorOrderIssue(
        vendorOrderId,
        "vendor_cancelled",
        "MEDIUM",
        { createdBy: "admin" }
      );
    }
    return NextResponse.json({
      ok: true,
      action: "transition",
      message:
        result.fulfillmentStatus === "cancelled"
          ? "Vendor order cancelled"
          : `→ ${result.routingStatus} / ${result.fulfillmentStatus}`,
      ...result,
    });
  }
  if (result.code === "NOT_FOUND") {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: 404 }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: result.error,
      code: result.code ?? "INVALID_TRANSITION",
    },
    { status: 400 }
  );
}
