import { NextResponse } from "next/server";
import { assertPodApiAccess } from "@/lib/permissions";
import { cancelPodVendorInvite, resendPodVendorInvite } from "@/services/pod-vendor-invite.service";

function requestOrigin(request: Request): string | undefined {
  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ podId: string; inviteId: string }> }
) {
  const { podId, inviteId } = await context.params;
  if (!podId || !inviteId) {
    return NextResponse.json({ error: "Missing podId or inviteId" }, { status: 400 });
  }

  const gate = await assertPodApiAccess(request, podId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const action =
    body && typeof body === "object" && "action" in body && typeof (body as { action: unknown }).action === "string"
      ? (body as { action: string }).action
      : "resend";

  if (action === "cancel") {
    const result = await cancelPodVendorInvite(podId, inviteId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const result = await resendPodVendorInvite({
    podId,
    inviteId,
    requestOrigin: requestOrigin(request),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    inviteId: result.inviteId,
    inviteUrl: result.inviteUrl,
    emailStatus: result.emailStatus,
  });
}
