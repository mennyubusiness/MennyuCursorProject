import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeSecureInviteTokenFromRequest } from "@/lib/auth/secure-invite-token";
import { acceptPodVendorInvite } from "@/services/pod-vendor-invite.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token =
    body && typeof body === "object" && "token" in body && typeof (body as { token: unknown }).token === "string"
      ? normalizeSecureInviteTokenFromRequest((body as { token: string }).token)
      : null;
  if (!token) {
    return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  }

  const result = await acceptPodVendorInvite({
    rawToken: token,
    userId: session.user.id,
    userEmail: session.user.email,
  });

  if (!result.ok) {
    const status =
      result.code === "email_mismatch" || result.code === "no_vendor_account" || result.code === "wrong_vendor"
        ? 403
        : result.code === "invalid" || result.code === "expired" || result.code === "cancelled"
          ? 400
          : 400;
    return NextResponse.json(
      {
        error: result.message,
        code: result.code,
        invitedEmail: result.invitedEmail,
        currentEmail: result.currentEmail,
      },
      { status }
    );
  }

  return NextResponse.json({
    vendorId: result.vendorId,
    podId: result.podId,
    podName: result.podName,
    alreadyAccepted: result.alreadyAccepted,
    redirectPath: `/vendor/${result.vendorId}/setup?access=pod_connected`,
  });
}
