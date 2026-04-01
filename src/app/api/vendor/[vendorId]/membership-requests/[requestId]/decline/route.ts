/**
 * Vendor declines a pod membership request.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";

const PENDING = "pending";
const DECLINED = "declined";

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
    select: { id: true, vendorId: true, status: true },
  });
  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (req.vendorId !== vendorId) {
    return NextResponse.json({ error: "This request is for another vendor" }, { status: 403 });
  }
  if (req.status !== PENDING) {
    return NextResponse.json(
      { error: "This request has already been responded to." },
      { status: 400 }
    );
  }

  const now = new Date();
  await prisma.podMembershipRequest.update({
    where: { id: requestId },
    data: { status: DECLINED, respondedAt: now, updatedAt: now },
  });

  return NextResponse.json({ ok: true });
}
