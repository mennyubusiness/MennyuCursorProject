/**
 * POST: Mark vendor order as manually received by vendor (admin exception recovery).
 * Sets fulfillmentStatus to "accepted" only; routingStatus is left unchanged (preserves failed/pending and Deliverect audit).
 * Requires a paid parent order and recovery notes. Idempotent when already beyond pending fulfillment.
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import {
  canManualRecoverVendorOrder,
  isOrderPaidForAdminRecovery,
} from "@/lib/admin-needs-attention-actions";
import { prisma } from "@/lib/db";
import { applyVendorOrderTransition } from "@/services/order-status.service";

const ELIGIBLE_FULFILLMENT = "pending";
const MIN_NOTE_LENGTH = 3;

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorOrderId" },
      { status: 400 }
    );
  }

  let notes = "";
  try {
    const body = (await request.json()) as { notes?: unknown };
    notes = typeof body.notes === "string" ? body.notes.trim() : "";
  } catch {
    notes = "";
  }
  if (notes.length < MIN_NOTE_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Recovery note is required (at least ${MIN_NOTE_LENGTH} characters).`,
        code: "NOTE_REQUIRED",
      },
      { status: 400 }
    );
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      fulfillmentStatus: true,
      routingStatus: true,
      deliverectOrderId: true,
      manuallyRecoveredAt: true,
      order: { select: { status: true } },
    },
  });
  if (!vo) {
    return NextResponse.json(
      { ok: false, error: "Vendor order not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const orderSnap = { status: vo.order.status };
  if (!isOrderPaidForAdminRecovery(orderSnap)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Manual recovery is only allowed after the customer has paid.",
        code: "ORDER_UNPAID",
      },
      { status: 400 }
    );
  }

  const voSnap = {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    deliverectOrderId: vo.deliverectOrderId,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
  };

  if (!canManualRecoverVendorOrder(voSnap, orderSnap)) {
    return NextResponse.json(
      {
        ok: false,
        error: "This vendor order cannot be manually recovered in its current state.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
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

  const recoveredAt = new Date();
  const result = await applyVendorOrderTransition(
    vendorOrderId,
    "accepted",
    "admin_manual_recovery",
    {
      extraVendorOrderUpdate: {
        manuallyRecoveredAt: recoveredAt,
        manuallyRecoveredBy: "admin",
        manualRecoveryNotes: notes,
        statusAuthority: "admin_override",
      },
      historyRawPayload: {
        targetState: "accepted",
        audit: {
          kind: "admin_manual_recovery",
          claimedAuthority: "admin_override",
          summary: notes,
        },
      },
      historyAuthority: "admin_override",
    }
  );

  if (result.success) {
    const { createVendorOrderIssue, getVendorOrderIssues, resolveVendorOrderIssue } = await import(
      "@/services/issues.service"
    );
    const openIssues = await getVendorOrderIssues(vendorOrderId, "OPEN");
    for (const issue of openIssues.filter((i) => i.type === "routing_failure")) {
      await resolveVendorOrderIssue(issue.id, { resolvedBy: "admin" });
    }
    if (!openIssues.some((i) => i.type === "manual_recovery")) {
      await createVendorOrderIssue(vendorOrderId, "manual_recovery", "MEDIUM", {
        notes,
        createdBy: "admin",
      });
    }
    return NextResponse.json({
      ok: true,
      action: "manual-recovery",
      message: "Vendor order marked as manually received by vendor",
      routingStatus: result.routingStatus,
      fulfillmentStatus: result.fulfillmentStatus,
      parentStatus: result.parentStatus,
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
