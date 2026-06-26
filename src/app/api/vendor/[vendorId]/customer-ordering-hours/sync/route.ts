/**
 * POST /api/vendor/[vendorId]/customer-ordering-hours/sync
 * Manually refresh customer ordering hours from Deliverect.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import { syncVendorCustomerOrderingHoursFromDeliverect } from "@/services/vendor-deliverect-hours-sync.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      vendorDashboardToken: true,
      syncCustomerOrderingHoursFromDeliverect: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(vendorId, request, vendor.vendorDashboardToken);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!vendor.syncCustomerOrderingHoursFromDeliverect) {
    return NextResponse.json(
      { error: "Enable “Sync hours from Deliverect” before refreshing synced hours." },
      { status: 400 }
    );
  }

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );
  if (!posConnected) {
    return NextResponse.json(
      { error: "Connect your POS before syncing customer ordering hours from Deliverect." },
      { status: 400 }
    );
  }

  const result = await syncVendorCustomerOrderingHoursFromDeliverect(vendorId);
  if ("skipped" in result) {
    return NextResponse.json({ error: "Hours sync is not available for this vendor." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        keptPreviousHours: result.keptPreviousHours,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    syncedAt: result.syncedAt,
    hadPreviousHours: result.hadPreviousHours,
  });
}
