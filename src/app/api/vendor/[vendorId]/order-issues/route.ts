/**
 * GET /api/vendor/[vendorId]/order-issues — customer issues scoped to this vendor.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import { listVendorOrderIssues } from "@/services/vendor-order-issue.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, vendorDashboardToken: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(
    vendorId,
    request,
    vendor.vendorDashboardToken
  );
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("filter");
  const filter =
    filterParam === "closed" || filterParam === "all" ? filterParam : "active";

  const issues = await listVendorOrderIssues(vendorId, filter);
  return NextResponse.json({ issues, filter });
}
