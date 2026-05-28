/**
 * PATCH /api/vendor/[vendorId]/order-issues/[issueId] — vendor acknowledge / respond only.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { VENDOR_ISSUE_ACTIONS } from "@/domain/vendor-order-issue";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import { updateVendorOrderIssue } from "@/services/vendor-order-issue.service";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    action: z.enum(VENDOR_ISSUE_ACTIONS),
    vendorResponse: z.string().max(5000).optional().nullable(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ vendorId: string; issueId: string }> }
) {
  const { vendorId, issueId } = await context.params;
  if (!vendorId || !issueId) {
    return NextResponse.json({ error: "Missing vendorId or issueId" }, { status: 400 });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateVendorOrderIssue(vendorId, issueId, {
    action: parsed.data.action,
    vendorResponse: parsed.data.vendorResponse,
    userId: access.userId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, issue: result.issue });
}
