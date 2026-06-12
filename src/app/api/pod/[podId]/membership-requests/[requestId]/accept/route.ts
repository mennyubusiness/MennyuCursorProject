/**
 * Admin-only: accept a pending membership request on behalf of a vendor.
 * Pod owners must not accept invites for vendors — vendor consent is required.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptPodMembershipRequest } from "@/lib/pod-membership-request-accept";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string; requestId: string }> }
) {
  const { podId, requestId } = await context.params;
  if (!podId || !requestId) {
    return NextResponse.json({ error: "Missing podId or requestId" }, { status: 400 });
  }

  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json(
      {
        error:
          "Only the vendor can accept this invitation. Ask them to accept from their vendor settings or dashboard.",
      },
      { status: 403 }
    );
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
