/**
 * Pod-scoped vendor invites (email + secure token).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertPodApiAccess } from "@/lib/permissions";
import {
  createPodVendorInvite,
  listPendingPodVendorInvites,
} from "@/services/pod-vendor-invite.service";

function requestOrigin(request: Request): string | undefined {
  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) return NextResponse.json({ error: "Missing podId" }, { status: 400 });

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  const invites = await listPendingPodVendorInvites(podId);
  return NextResponse.json({ invites });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string }> }
) {
  const { podId } = await context.params;
  if (!podId) return NextResponse.json({ error: "Missing podId" }, { status: 400 });

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const invitedEmail = typeof data.invitedEmail === "string" ? data.invitedEmail : "";
  if (!invitedEmail.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const result = await createPodVendorInvite({
    podId,
    createdByUserId: userId,
    invitedEmail,
    invitedVendorName: typeof data.invitedVendorName === "string" ? data.invitedVendorName : null,
    invitedContactName: typeof data.invitedContactName === "string" ? data.invitedContactName : null,
    invitedPhone: typeof data.invitedPhone === "string" ? data.invitedPhone : null,
    note: typeof data.note === "string" ? data.note : null,
    targetVendorId: typeof data.targetVendorId === "string" ? data.targetVendorId : null,
    sendEmail: data.sendEmail !== false,
    requestOrigin: requestOrigin(request),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    inviteId: result.inviteId,
    inviteUrl: result.inviteUrl,
    emailStatus: result.emailStatus,
  });
}
