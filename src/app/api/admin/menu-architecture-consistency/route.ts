/**
 * GET: Admin/dev menu architecture consistency report (Phase 2).
 * Query: optional ?vendorId=
 * Never returns tokens or connection secrets.
 *
 * Auth: same gate as other /api/admin/* handlers — `isAdminApiRequestAuthorized`
 * (dev open, ADMIN_SECRET bridge, or platform-admin session).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { buildMenuArchitectureConsistencyReport } from "@/lib/admin-menu-architecture-consistency.server";

export async function GET(request: NextRequest) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  const report = await buildMenuArchitectureConsistencyReport({
    vendorId: vendorId?.trim() || null,
  });
  return NextResponse.json(report);
}
