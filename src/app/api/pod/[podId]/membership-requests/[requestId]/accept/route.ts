/**
 * Pod owner accepts a pending membership request (adds vendor to pod).
 * Same outcome as vendor-side accept; use when pod curates roster directly.
 * Access: same trust model as other pod APIs (layout-gated in UI).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptPodMembershipRequest } from "@/lib/pod-membership-request-accept";

export async function POST(
  _request: Request,
  context: { params: Promise<{ podId: string; requestId: string }> }
) {
  const { podId, requestId } = await context.params;
  if (!podId || !requestId) {
    return NextResponse.json({ error: "Missing podId or requestId" }, { status: 400 });
  }

  const req = await prisma.podMembershipRequest.findUnique({
    where: { id: requestId },
    select: { podId: true },
  });
  if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (req.podId !== podId) {
    return NextResponse.json({ error: "Request does not belong to this pod" }, { status: 403 });
  }

  const result = await acceptPodMembershipRequest(requestId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
