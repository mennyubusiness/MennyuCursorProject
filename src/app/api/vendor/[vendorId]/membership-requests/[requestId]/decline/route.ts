/**
 * Vendor declines a pod membership request.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PENDING = "pending";
const DECLINED = "declined";

export async function POST(
  _request: Request,
  context: { params: Promise<{ vendorId: string; requestId: string }> }
) {
  const { vendorId, requestId } = await context.params;
  if (!vendorId || !requestId) {
    return NextResponse.json({ error: "Missing vendorId or requestId" }, { status: 400 });
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
