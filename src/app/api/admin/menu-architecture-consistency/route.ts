/**
 * GET: Admin/dev menu architecture consistency report (Phase 2).
 * Query: optional ?vendorId=
 * Never returns tokens or connection secrets.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/permissions";
import { buildMenuArchitectureConsistencyReport } from "@/lib/admin-menu-architecture-consistency.server";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !(await isPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  const report = await buildMenuArchitectureConsistencyReport({
    vendorId: vendorId?.trim() || null,
  });
  return NextResponse.json(report);
}
