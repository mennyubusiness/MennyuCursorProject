/**
 * POST: Retry routing for a vendor order (reuse submitVendorOrderToDeliverect).
 * Returns ok: false with unavailable: true when Deliverect is not configured.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRoutingRetryAvailable, getRoutingUnavailableReason } from "@/lib/routing-availability";
import { submitVendorOrderToDeliverect } from "@/services/deliverect.service";

const DEFAULT_PREP_MINUTES = 15;

export async function POST(
  _request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorOrderId" },
      { status: 400 }
    );
  }

  if (!isRoutingRetryAvailable()) {
    return NextResponse.json({
      ok: false,
      error: getRoutingUnavailableReason(),
      unavailable: true,
    });
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    include: { order: { select: { customerPhone: true, customerEmail: true } } },
  });
  if (!vo) {
    return NextResponse.json(
      { ok: false, error: "Vendor order not found" },
      { status: 404 }
    );
  }

  const result = await submitVendorOrderToDeliverect(
    vendorOrderId,
    vo.order.customerPhone,
    vo.order.customerEmail ?? null,
    DEFAULT_PREP_MINUTES
  );

  if (result.skipped) {
    return NextResponse.json({
      ok: false,
      error: "Routing retry is unavailable in this environment (submission skipped).",
      unavailable: true,
    });
  }
  if (result.success) {
    return NextResponse.json({
      ok: true,
      action: "retry-routing",
      message: "Routing submitted",
      deliverectOrderId: result.deliverectOrderId,
    });
  }
  return NextResponse.json({
    ok: false,
    error: result.error ?? "Submission failed",
    code: result.code,
  });
}
