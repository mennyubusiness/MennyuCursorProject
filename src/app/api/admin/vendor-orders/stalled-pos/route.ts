/**
 * GET: List POS-managed vendor orders that may be stalled (heuristic).
 * Query: minMinutes (default 45) — VendorOrder.updatedAt older than this threshold.
 */
import { NextRequest, NextResponse } from "next/server";
import { findStalledPosManagedVendorOrders } from "@/services/pos-stalled-vendor-orders.service";

const DEFAULT_MIN_MINUTES = 45;
const MAX_MIN_MINUTES = 24 * 60;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("minMinutes");
  let minIdleMinutes = DEFAULT_MIN_MINUTES;
  if (raw != null) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > MAX_MIN_MINUTES) {
      return NextResponse.json(
        { error: `minMinutes must be 1–${MAX_MIN_MINUTES}` },
        { status: 400 }
      );
    }
    minIdleMinutes = n;
  }

  const stalled = await findStalledPosManagedVendorOrders({ minIdleMinutes });
  return NextResponse.json({
    ok: true,
    minIdleMinutes,
    count: stalled.length,
    stalled,
  });
}
