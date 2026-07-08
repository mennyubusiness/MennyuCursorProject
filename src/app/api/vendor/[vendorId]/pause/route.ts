/**
 * PATCH /api/vendor/[vendorId]/pause
 * Body: { paused: boolean }
 * Toggles Mennyu order intake for this vendor. Does not affect POS or existing in-progress orders.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidateVendorCustomerOrderingSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const paused = typeof obj?.paused === "boolean" ? obj.paused : null;

  if (paused === null) {
    return NextResponse.json(
      { error: "Missing or invalid body: { paused: boolean }" },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, vendorDashboardToken: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(
    vendorId,
    request,
    vendor.vendorDashboardToken
  );
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { mennyuOrdersPaused: paused },
  });

  await revalidateVendorCustomerOrderingSurfaces(vendorId);

  return NextResponse.json({ paused });
}
