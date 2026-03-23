/**
 * POST: Generate or rotate Vendor.vendorDashboardToken (admin-only). Returns plaintext once — store securely.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const querySecret = request.nextUrl.searchParams.get("admin");
  if (!isAdminAllowed(cookie, querySecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  if (!vendorId?.trim()) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");

  await prisma.vendor.update({
    where: { id: vendorId.trim() },
    data: { vendorDashboardToken: token },
  });

  return NextResponse.json({
    vendorId: vendorId.trim(),
    vendorDashboardToken: token,
    message:
      "Save this secret for API/automation only; prefer POST .../dashboard-access-link to email vendors a magic URL (no paste). If you share this token, the vendor can paste it under Settings → Manual token.",
  });
}
