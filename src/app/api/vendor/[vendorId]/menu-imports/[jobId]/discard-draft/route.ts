/**
 * POST: Discard draft MenuVersion for this vendor's import job only.
 * Same auth as vendor publish (dashboard token cookie or Bearer).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import {
  DraftMenuVersionDiscardError,
  discardDraftMenuVersionForImportJob,
} from "@/services/discard-draft-menu-version.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string; jobId: string }> }
) {
  const { vendorId, jobId } = await context.params;
  if (!vendorId?.trim() || !jobId?.trim()) {
    return NextResponse.json({ error: "Missing vendorId or jobId" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { id: true, vendorDashboardToken: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(vendor.id, request, vendor.vendorDashboardToken);
  if (!access.ok) {
    return NextResponse.json(
      {
        error:
          "Forbidden: vendor membership, legacy token, or Mennyu admin authentication required.",
        code: "VENDOR_DASHBOARD_AUTH",
      },
      { status: 403 }
    );
  }

  const job = await prisma.menuImportJob.findUnique({
    where: { id: jobId.trim() },
    select: { id: true, vendorId: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.vendorId !== vendor.id) {
    return NextResponse.json({ error: "This menu import does not belong to this vendor." }, { status: 403 });
  }

  try {
    const discardedBy = access.mode === "admin" ? "admin" : "vendor";
    const result = await discardDraftMenuVersionForImportJob({
      jobId: job.id,
      discardedBy,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof DraftMenuVersionDiscardError) {
      const status = e.code === "JOB_NOT_FOUND" || e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[vendor menu-import discard-draft]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
