/**
 * Vendor accepts a pod membership request.
 * If vendor is in another pod, move atomically (delete old + create new). One pod per vendor.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PENDING = "pending";
const ACCEPTED = "accepted";
const CANCELLED = "cancelled";

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
    include: { pod: { select: { id: true, name: true } } },
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

  await prisma.$transaction(async (tx) => {
    const existing = await tx.podVendor.findFirst({
      where: { vendorId },
      select: { podId: true },
    });

    if (existing) {
      if (existing.podId === req.podId) {
        await tx.podMembershipRequest.update({
          where: { id: requestId },
          data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
        });
        return;
      }
      await tx.podVendor.deleteMany({ where: { vendorId } });
    }

    await tx.podVendor.create({
      data: { podId: req.podId, vendorId },
    });
    await tx.podMembershipRequest.update({
      where: { id: requestId },
      data: { status: ACCEPTED, respondedAt: now, updatedAt: now },
    });

    await tx.podMembershipRequest.updateMany({
      where: { vendorId, id: { not: requestId }, status: PENDING },
      data: { status: CANCELLED, updatedAt: now },
    });
  });

  return NextResponse.json({ ok: true });
}
