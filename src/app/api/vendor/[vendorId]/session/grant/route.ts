/**
 * GET: Exchange a signed magic-link token for the standard vendor dashboard httpOnly cookie.
 * Token is short-lived and does not contain the long-lived dashboard secret.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeVendorDashboardRedirectPath, verifyVendorAccessLinkToken } from "@/lib/vendor-access-link";
import { setVendorDashboardSessionCookie } from "@/lib/vendor-dashboard-session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  const id = vendorId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(
      new URL(`/vendor/${encodeURIComponent(id)}/settings?access=missing_token`, request.url)
    );
  }

  let payloadVendorId: string;
  let redirectPath: string;
  try {
    const payload = verifyVendorAccessLinkToken(token);
    payloadVendorId = payload.vendorId;
    redirectPath = safeVendorDashboardRedirectPath(payload.vendorId, payload.redirectPath);
  } catch {
    return NextResponse.redirect(
      new URL(`/vendor/${encodeURIComponent(id)}/settings?access=invalid`, request.url)
    );
  }

  if (payloadVendorId !== id) {
    return NextResponse.redirect(
      new URL(`/vendor/${encodeURIComponent(id)}/settings?access=vendor_mismatch`, request.url)
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, vendorDashboardToken: true },
  });
  if (!vendor?.vendorDashboardToken?.trim()) {
    return NextResponse.redirect(
      new URL(`/vendor/${encodeURIComponent(id)}/settings?access=no_secret`, request.url)
    );
  }

  await setVendorDashboardSessionCookie(vendor.id, vendor.vendorDashboardToken);

  const res = NextResponse.redirect(new URL(redirectPath, request.url));
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
