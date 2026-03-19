/**
 * GET: Deliverect ↔ Mennyu sync debug snapshot for one vendor order (read-only).
 */
import { NextResponse } from "next/server";
import { getVendorOrderDeliverectSyncDebug } from "@/services/deliverect-vendor-order-sync-debug.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ error: "Missing vendorOrderId" }, { status: 400 });
  }

  const debug = await getVendorOrderDeliverectSyncDebug(vendorOrderId);
  if (!debug) {
    return NextResponse.json({ error: "Vendor order not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, debug });
}
