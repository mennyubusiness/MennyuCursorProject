/**
 * POST: Mint a signed URL that grants vendor dashboard session (httpOnly cookie) without pasting the long-lived token.
 * Admin-only. Ensures Vendor.vendorDashboardToken exists (generates one if missing).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { signVendorAccessLinkToken } from "@/lib/vendor-access-link";

function publicOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  const id = vendorId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: { redirectPath?: string | null; expiresInSec?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, vendorDashboardToken: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  let provisionedSecret = false;
  let dashboardToken = vendor.vendorDashboardToken?.trim() ?? "";
  if (!dashboardToken) {
    dashboardToken = randomBytes(32).toString("hex");
    await prisma.vendor.update({
      where: { id },
      data: { vendorDashboardToken: dashboardToken },
    });
    provisionedSecret = true;
  }

  let signed: string;
  try {
    signed = signVendorAccessLinkToken(id, {
      expiresInSec: body.expiresInSec ?? undefined,
      redirectPath: body.redirectPath ?? `/vendor/${id}/menu-imports`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: msg,
        hint:
          "Set VENDOR_ACCESS_SIGNING_SECRET (min 32 chars) in production to mint magic links.",
      },
      { status: 503 }
    );
  }

  const origin = publicOrigin(request);
  const url = `${origin}/api/vendor/${encodeURIComponent(id)}/session/grant?token=${encodeURIComponent(signed)}`;

  return NextResponse.json({
    vendorId: id,
    url,
    provisionedDashboardSecret: provisionedSecret,
    message: provisionedSecret
      ? "A long-lived dashboard secret was generated server-side (not returned here). Send the url to the vendor."
      : "Send url to the vendor; opening it sets a browser session for ~90 days.",
  });
}
