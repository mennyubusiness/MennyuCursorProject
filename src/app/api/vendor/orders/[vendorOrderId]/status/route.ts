/**
 * POST /api/vendor/orders/[vendorOrderId]/status
 * Body: { targetState, vendorId }
 * Verifies the vendor order belongs to the vendor, then applies the same transition used by the dev simulator.
 * Updates customer order tracking and can trigger SMS when parent status changes.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyVendorOrderTransition } from "@/services/order-status.service";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";
import type { VendorOrderTargetState } from "@/domain/vendor-order-transition";

const VENDOR_DASHBOARD_SOURCE = "vendor_dashboard";

const ALLOWED_TARGETS: VendorOrderTargetState[] = [
  "confirmed", // sent → confirmed (vendor acknowledges receipt)
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ error: "Missing vendorOrderId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const vendorId = typeof obj?.vendorId === "string" ? obj.vendorId : null;
  const targetState = typeof obj?.targetState === "string" ? obj.targetState : null;

  if (!vendorId || !targetState) {
    return NextResponse.json(
      { error: "Missing or invalid vendorId or targetState" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TARGETS.includes(targetState as VendorOrderTargetState)) {
    return NextResponse.json(
      {
        error: `Invalid targetState. Allowed for vendor dashboard: ${ALLOWED_TARGETS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      vendorId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      statusHistory: { select: { source: true } },
    },
  });
  if (!vo) {
    return NextResponse.json({ error: "Vendor order not found" }, { status: 404 });
  }
  if (vo.vendorId !== vendorId) {
    return NextResponse.json({ error: "Vendor order does not belong to this vendor" }, { status: 403 });
  }

  if (targetState === "cancelled" && !canVendorRejectVendorOrder(vo)) {
    return NextResponse.json(
      {
        error:
          "This order can no longer be denied. Only orders that are not yet preparing can be rejected.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  try {
    const result = await applyVendorOrderTransition(
      vendorOrderId,
      targetState as VendorOrderTargetState,
      VENDOR_DASHBOARD_SOURCE
    );

    if (result.success) {
      return NextResponse.json(result);
    }

    if (result.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
