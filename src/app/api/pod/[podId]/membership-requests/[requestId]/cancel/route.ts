/**
 * Pod owner cancels a pending membership request.
 * Only pending requests can be cancelled. Request must belong to this pod.
 * Access: same as pod dashboard (layout guard).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PENDING = "pending";
const CANCELLED = "cancelled";

export async function POST(
  _request: Request,
  context: { params: Promise<{ podId: string; requestId: string }> }
) {
  const { podId, requestId } = await context.params;
  if (!podId || !requestId) {
    return NextResponse.json({ error: "Missing podId or requestId" }, { status: 400 });
  }

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true },
  });
  if (!pod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });

  const req = await prisma.podMembershipRequest.findUnique({
    where: { id: requestId },
    select: { id: true, podId: true, status: true },
  });
  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (req.podId !== podId) {
    return NextResponse.json({ error: "Request does not belong to this pod" }, { status: 403 });
  }
  if (req.status !== PENDING) {
    return NextResponse.json(
      { error: "Only pending requests can be cancelled." },
      { status: 400 }
    );
  }

  await prisma.podMembershipRequest.update({
    where: { id: requestId },
    data: { status: CANCELLED, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
