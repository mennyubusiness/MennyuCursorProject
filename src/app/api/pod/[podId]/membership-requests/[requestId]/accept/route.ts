/**
 * Pod owner accepts a pending membership request (adds vendor to pod).
 * Same outcome as vendor-side accept; use when pod curates roster directly.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptPodMembershipRequest } from "@/lib/pod-membership-request-accept";
import { assertPodApiAccess } from "@/lib/permissions";

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string; requestId: string }> }
) {
  const { podId, requestId } = await context.params;
  if (!podId || !requestId) {
    return NextResponse.json({ error: "Missing podId or requestId" }, { status: 400 });
  }

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
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
