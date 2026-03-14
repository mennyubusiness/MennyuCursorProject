/**
 * POST: Mark vendor order as manually received by vendor (admin exception recovery).
 * Sets fulfillmentStatus to "accepted" only; routingStatus is left unchanged (preserves failed/pending and Deliverect audit).
 * Idempotent: if fulfillmentStatus is already beyond pending, returns no-op and does not write.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyVendorOrderTransition } from "@/services/order-status.service";

const ELIGIBLE_FULFILLMENT = "pending";

export async function POST(
  _request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorOrderId" },
      { status: 400 }
    );
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { fulfillmentStatus: true, routingStatus: true },
  });
  if (!vo) {
    return NextResponse.json(
      { ok: false, error: "Vendor order not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (vo.fulfillmentStatus !== ELIGIBLE_FULFILLMENT) {
    return NextResponse.json({
      ok: true,
      noop: true,
      message: "Vendor order is already accepted or manually recovered",
      fulfillmentStatus: vo.fulfillmentStatus,
      routingStatus: vo.routingStatus,
    });
  }

  const result = await applyVendorOrderTransition(
    vendorOrderId,
    "accepted",
    "admin_manual_recovery"
  );

  if (result.success) {
    // Record manual recovery metadata; routing failure stays in DB for audit.
    await prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: {
        manuallyRecoveredAt: new Date(),
        manuallyRecoveredBy: "admin",
      },
    });

    const { createVendorOrderIssue, getVendorOrderIssues, resolveVendorOrderIssue } = await import("@/services/issues.service");
    const openIssues = await getVendorOrderIssues(vendorOrderId, "OPEN");
    for (const issue of openIssues.filter((i) => i.type === "routing_failure")) {
      await resolveVendorOrderIssue(issue.id, { resolvedBy: "admin" });
    }
    if (!openIssues.some((i) => i.type === "manual_recovery")) {
      await createVendorOrderIssue(vendorOrderId, "manual_recovery", "MEDIUM", {
        notes: "Admin marked as manually received by vendor",
        createdBy: "admin",
      });
    }
    return NextResponse.json({
      ok: true,
      action: "manual-recovery",
      message: "Vendor order marked as manually received by vendor",
      routingStatus: result.routingStatus,
      fulfillmentStatus: result.fulfillmentStatus,
    });
  }
  if (result.code === "NOT_FOUND") {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: 404 }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: result.error,
      code: result.code ?? "INVALID_TRANSITION",
    },
    { status: 400 }
  );
}
