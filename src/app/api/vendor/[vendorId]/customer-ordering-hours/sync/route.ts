/**
 * POST /api/vendor/[vendorId]/customer-ordering-hours/sync
 * Deliverect hours sync is disabled for vendor-facing use while API permissions are unresolved.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";

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
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(vendorId, request, vendor.vendorDashboardToken);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Deliverect hours sync is temporarily unavailable. Enter customer ordering hours manually on the Hours page.",
    },
    { status: 503 }
  );
}
