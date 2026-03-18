/**
 * POST: Retry routing for a vendor order via the routing service.
 * Returns ok: false with unavailable: true when routing is not configured (e.g. ROUTING_MODE=mock).
 */
import { NextResponse } from "next/server";
import { isRoutingRetryAvailable, getRoutingUnavailableReason } from "@/lib/routing-availability";
import { retryVendorOrderRouting } from "@/services/routing.service";

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

  const result = await retryVendorOrderRouting(vendorOrderId);

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
      deliverectOrderId: result.externalOrderId,
    });
  }
  return NextResponse.json({
    ok: false,
    error: result.error ?? "Submission failed",
    code: result.code,
  });
}
