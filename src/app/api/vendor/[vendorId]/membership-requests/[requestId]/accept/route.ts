/**
 * Vendor accepts a pod membership request.
 * If vendor is in another pod, move atomically (delete old + create new). One pod per vendor.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptPodMembershipRequest } from "@/lib/pod-membership-request-accept";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorId: string; requestId: string }> }
) {
  const { vendorId, requestId } = await context.params;
  if (!vendorId || !requestId) {
    return NextResponse.json({ error: "Missing vendorId or requestId" }, { status: 400 });
  }

  const v = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { vendorDashboardToken: true },
  });
  const access = await verifyVendorAccessForApi(vendorId, request, v?.vendorDashboardToken ?? null);
  if (!access.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const req = await prisma.podMembershipRequest.findUnique({
    where: { id: requestId },
    select: { vendorId: true },
  });
  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (req.vendorId !== vendorId) {
    return NextResponse.json({ error: "This request is for another vendor" }, { status: 403 });
  }

  const result = await acceptPodMembershipRequest(requestId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
