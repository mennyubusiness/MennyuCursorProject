/**
 * POST: Publish draft menu for this vendor only. Requires vendor dashboard token (cookie or Bearer) in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import {
  MenuPublishValidationError,
  publishMenuImportDraftToLive,
} from "@/services/menu-publish-from-canonical.service";

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
          "Forbidden: sign in with a user linked to this vendor, use a legacy dashboard token, or authenticate as Mennyu admin.",
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
    const publishedBy =
      access.mode === "admin"
        ? "admin:help"
        : access.mode === "session" && access.userId
          ? `user:${access.userId}`
          : `vendor:${vendor.id}`;
    const result = await publishMenuImportDraftToLive({
      jobId: job.id,
      publishedBy,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MenuPublishValidationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[vendor menu-import publish]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
