/**
 * Authoritative refund ledger: OrderRefund rows, denormalized totals, legacy RefundAttempt compatibility.
 */
import type {
  OrderRefundInitiatedByRole,
  OrderRefundScope,
  OrderRefundStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertRefundAmountWithinCaps,
  computeRemainingRefundableCents,
  computeCommittedRefundCents,
  computeTotalRefundedCents,
  computeVendorOrderRefundedCents,
  derivePaymentRefundStatus,
  mapStripeRefundStatus,
  ORDER_REFUND_SUCCEEDED_STATUS,
} from "@/domain/order-refund";
import type { PaymentRefundStatusLabel } from "@/domain/order-refund";
import { syncVendorTransferEligibilityAfterRefundSuccess } from "@/services/vendor-payout-transfer-refund-eligibility.service";

export type OrderRefundSummary = {
  orderId: string;
  paymentAmountCents: number;
  ledgerRefundedCents: number;
  legacyRefundedCents: number;
  totalRefundedCents: number;
  remainingRefundableCents: number;
  paymentRefundStatus: PaymentRefundStatusLabel;
  hasPendingRefund: boolean;
  refunds: Array<{
    id: string;
    amountCents: number;
    status: OrderRefundStatus;
    stripeRefundId: string | null;
    vendorOrderId: string | null;
    source: "order_refund" | "legacy_refund_attempt";
  }>;
};

export type VendorOrderRefundSummary = {
  vendorOrderId: string;
  orderId: string;
  vendorOrderTotalCents: number;
  totalRefundedCents: number;
  remainingRefundableCents: number;
};

export type RecordPendingRefundInput = {
  orderId: string;
  vendorOrderId?: string | null;
  amountCents: number;
  idempotencyKey: string;
  reason: string;
  refundScope: OrderRefundScope;
  initiatedByRole: OrderRefundInitiatedByRole;
  initiatedByUserId?: string | null;
  refundAttemptId?: string | null;
  stripePaymentIntentId: string;
  stripeChargeId?: string | null;
  paymentId?: string | null;
  adminNote?: string | null;
  customerVisibleNote?: string | null;
};

async function loadRefundContext(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      totalRefundedCents: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, amountCents: true, stripePaymentIntentId: true },
      },
      orderRefunds: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          vendorOrderId: true,
          stripeRefundId: true,
          refundAttemptId: true,
        },
      },
      refundAttempts: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          vendorOrderId: true,
          stripeRefundId: true,
        },
      },
    },
  });
  if (!order) return null;
  const payment = order.payments[0] ?? null;
  const linkedAttemptIds = new Set(
    order.orderRefunds.map((r) => r.refundAttemptId).filter((id): id is string => Boolean(id))
  );
  const legacyAttempts = order.refundAttempts.map((a) => ({
    ...a,
    hasLinkedOrderRefund: linkedAttemptIds.has(a.id),
  }));
  return { order, payment, legacyAttempts };
}

function buildRefundRows(
  orderRefunds: Array<{
    id: string;
    amountCents: number;
    status: OrderRefundStatus;
    stripeRefundId: string | null;
    vendorOrderId: string | null;
  }>,
  legacyAttempts: Array<{
    id: string;
    amountCents: number;
    status: string;
    stripeRefundId: string | null;
    vendorOrderId: string | null;
    hasLinkedOrderRefund: boolean;
  }>
) {
  const rows: OrderRefundSummary["refunds"] = orderRefunds.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    status: r.status,
    stripeRefundId: r.stripeRefundId,
    vendorOrderId: r.vendorOrderId,
    source: "order_refund" as const,
  }));
  for (const a of legacyAttempts) {
    if (a.hasLinkedOrderRefund) continue;
    rows.push({
      id: `legacy:${a.id}`,
      amountCents: a.amountCents,
      status: a.status as OrderRefundStatus,
      stripeRefundId: a.stripeRefundId,
      vendorOrderId: a.vendorOrderId,
      source: "legacy_refund_attempt",
    });
  }
  return rows;
}

export async function getOrderRefundSummary(orderId: string): Promise<OrderRefundSummary | null> {
  const ctx = await loadRefundContext(orderId);
  if (!ctx) return null;

  const paymentAmountCents = ctx.payment?.amountCents ?? ctx.order.totalCents;
  const { ledgerCents, legacyCents, totalCents } = computeTotalRefundedCents({
    orderRefunds: ctx.order.orderRefunds,
    legacyAttempts: ctx.legacyAttempts,
  });
  const hasPendingRefund =
    ctx.order.orderRefunds.some((r) => r.status === "pending" || r.status === "requires_action") ||
    ctx.legacyAttempts.some((a) => a.status === "attempted");

  return {
    orderId,
    paymentAmountCents,
    ledgerRefundedCents: ledgerCents,
    legacyRefundedCents: legacyCents,
    totalRefundedCents: totalCents,
    remainingRefundableCents: computeRemainingRefundableCents(
      paymentAmountCents,
      computeCommittedRefundCents({
        orderRefunds: ctx.order.orderRefunds,
        legacyAttempts: ctx.legacyAttempts,
      })
    ),
    paymentRefundStatus: derivePaymentRefundStatus({
      paymentAmountCents,
      totalRefundedCents: totalCents,
      hasPendingRefund,
    }),
    hasPendingRefund,
    refunds: buildRefundRows(ctx.order.orderRefunds, ctx.legacyAttempts),
  };
}

export async function getVendorOrderRefundSummary(
  vendorOrderId: string
): Promise<VendorOrderRefundSummary | null> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { id: true, orderId: true, totalCents: true, totalRefundedCents: true },
  });
  if (!vo) return null;

  const ctx = await loadRefundContext(vo.orderId);
  if (!ctx) return null;

  const totalRefundedCents = computeVendorOrderRefundedCents({
    vendorOrderId,
    orderRefunds: ctx.order.orderRefunds,
    legacyAttempts: ctx.legacyAttempts,
  });
  const committedCents = computeVendorOrderRefundedCents({
    vendorOrderId,
    orderRefunds: ctx.order.orderRefunds,
    legacyAttempts: ctx.legacyAttempts,
    committed: true,
  });

  return {
    vendorOrderId,
    orderId: vo.orderId,
    vendorOrderTotalCents: vo.totalCents,
    totalRefundedCents,
    remainingRefundableCents: computeRemainingRefundableCents(vo.totalCents, committedCents),
  };
}

export async function getRemainingOrderRefundableCents(orderId: string): Promise<number> {
  const summary = await getOrderRefundSummary(orderId);
  return summary?.remainingRefundableCents ?? 0;
}

export async function getRemainingVendorOrderRefundableCents(
  vendorOrderId: string
): Promise<number> {
  const summary = await getVendorOrderRefundSummary(vendorOrderId);
  return summary?.remainingRefundableCents ?? 0;
}

async function refreshOrderRefundDenormalized(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const ctx = await loadRefundContextInTx(tx, orderId);
  if (!ctx) return;

  const paymentAmountCents = ctx.payment?.amountCents ?? ctx.order.totalCents;
  const { totalCents } = computeTotalRefundedCents({
    orderRefunds: ctx.order.orderRefunds,
    legacyAttempts: ctx.legacyAttempts,
  });
  const hasPendingRefund = ctx.order.orderRefunds.some(
    (r) => r.status === "pending" || r.status === "requires_action"
  );

  await tx.order.update({
    where: { id: orderId },
    data: {
      totalRefundedCents: totalCents,
      paymentRefundStatus: derivePaymentRefundStatus({
        paymentAmountCents,
        totalRefundedCents: totalCents,
        hasPendingRefund,
      }),
    },
  });

  const vendorIds = [
    ...new Set(
      ctx.order.orderRefunds
        .map((r) => r.vendorOrderId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  for (const vid of vendorIds) {
    const voTotal = await tx.vendorOrder.findUnique({
      where: { id: vid },
      select: { totalCents: true },
    });
    if (!voTotal) continue;
    const voRefunded = computeVendorOrderRefundedCents({
      vendorOrderId: vid,
      orderRefunds: ctx.order.orderRefunds,
      legacyAttempts: ctx.legacyAttempts,
    });
    await tx.vendorOrder.update({
      where: { id: vid },
      data: { totalRefundedCents: voRefunded },
    });
  }
}

async function loadRefundContextInTx(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      totalRefundedCents: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, amountCents: true, stripePaymentIntentId: true },
      },
      orderRefunds: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          vendorOrderId: true,
          stripeRefundId: true,
          refundAttemptId: true,
        },
      },
      refundAttempts: {
        select: {
          id: true,
          amountCents: true,
          status: true,
          vendorOrderId: true,
          stripeRefundId: true,
        },
      },
    },
  });
  if (!order) return null;
  const payment = order.payments[0] ?? null;
  const linkedAttemptIds = new Set(
    order.orderRefunds.map((r) => r.refundAttemptId).filter((id): id is string => Boolean(id))
  );
  const legacyAttempts = order.refundAttempts.map((a) => ({
    ...a,
    hasLinkedOrderRefund: linkedAttemptIds.has(a.id),
  }));
  return { order, payment, legacyAttempts };
}

export async function recordPendingRefund(
  input: RecordPendingRefundInput
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.orderRefund.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }

  const ctx = await loadRefundContext(input.orderId);
  if (!ctx) throw new Error("ORDER_NOT_FOUND");

  const paymentAmountCents = ctx.payment?.amountCents ?? ctx.order.totalCents;
  const committedCents = computeCommittedRefundCents({
    orderRefunds: ctx.order.orderRefunds,
    legacyAttempts: ctx.legacyAttempts,
  });

  let vendorOrderTotalCents: number | null = null;
  let vendorOrderRefundedCents: number | null = null;
  if (input.vendorOrderId) {
    const vo = await prisma.vendorOrder.findUnique({
      where: { id: input.vendorOrderId },
      select: { totalCents: true, orderId: true },
    });
    if (!vo || vo.orderId !== input.orderId) throw new Error("VENDOR_ORDER_NOT_FOUND");
    vendorOrderTotalCents = vo.totalCents;
    vendorOrderRefundedCents = computeVendorOrderRefundedCents({
      vendorOrderId: input.vendorOrderId,
      orderRefunds: ctx.order.orderRefunds,
      legacyAttempts: ctx.legacyAttempts,
      committed: true,
    });
  }

  assertRefundAmountWithinCaps({
    amountCents: input.amountCents,
    orderPaidCents: paymentAmountCents,
    orderRefundedCents: committedCents,
    vendorOrderTotalCents,
    vendorOrderRefundedCents,
  });

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.orderRefund.create({
      data: {
        orderId: input.orderId,
        vendorOrderId: input.vendorOrderId ?? null,
        paymentId: input.paymentId ?? ctx.payment?.id ?? null,
        refundAttemptId: input.refundAttemptId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeChargeId: input.stripeChargeId ?? null,
        amountCents: input.amountCents,
        currency: "usd",
        reason: input.reason,
        status: "pending",
        refundScope: input.refundScope,
        initiatedByRole: input.initiatedByRole,
        initiatedByUserId: input.initiatedByUserId ?? null,
        idempotencyKey: input.idempotencyKey,
        adminNote: input.adminNote ?? null,
        customerVisibleNote: input.customerVisibleNote ?? null,
      },
    });

    await refreshOrderRefundDenormalized(tx, input.orderId);
    return created;
  });

  return { id: row.id, created: true };
}

export async function markRefundSucceeded(args: {
  orderRefundId: string;
  stripeRefundId: string;
  stripeRawJson?: Prisma.InputJsonValue;
  completedAt?: Date;
}): Promise<void> {
  const refundRow = await prisma.orderRefund.findUnique({
    where: { id: args.orderRefundId },
    select: {
      orderId: true,
      vendorOrderId: true,
      refundAttemptId: true,
      status: true,
    },
  });
  if (!refundRow) throw new Error("ORDER_REFUND_NOT_FOUND");

  const wasSucceeded = refundRow.status === ORDER_REFUND_SUCCEEDED_STATUS;

  await prisma.$transaction(async (tx) => {
    await tx.orderRefund.update({
      where: { id: args.orderRefundId },
      data: {
        status: ORDER_REFUND_SUCCEEDED_STATUS,
        stripeRefundId: args.stripeRefundId,
        stripeRawJson: args.stripeRawJson ?? undefined,
        completedAt: args.completedAt ?? new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });

    if (!wasSucceeded) {
      await refreshOrderRefundDenormalized(tx, refundRow.orderId);
    }
  });

  if (!wasSucceeded) {
    await syncVendorTransferEligibilityAfterRefundSuccess({
      orderId: refundRow.orderId,
      vendorOrderId: refundRow.vendorOrderId,
      orderRefundId: args.orderRefundId,
      refundAttemptId: refundRow.refundAttemptId,
    }).catch(() => undefined);
  }
}

export async function markRefundFailed(args: {
  orderRefundId: string;
  failureCode: string;
  failureMessage: string;
  stripeRawJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await tx.orderRefund.findUnique({ where: { id: args.orderRefundId } });
    if (!row) throw new Error("ORDER_REFUND_NOT_FOUND");

    await tx.orderRefund.update({
      where: { id: args.orderRefundId },
      data: {
        status: "failed",
        failureCode: args.failureCode,
        failureMessage: args.failureMessage.slice(0, 2000),
        stripeRawJson: args.stripeRawJson ?? undefined,
      },
    });

    await refreshOrderRefundDenormalized(tx, row.orderId);
  });
}

export type SyncRefundResult =
  | { outcome: "synced"; orderRefundId: string }
  | { outcome: "unmatched"; reason: string };

export async function syncRefundFromStripeRefundObject(
  refund: {
    id: string;
    amount: number;
    currency: string;
    status: string | null;
    payment_intent?: string | { id: string } | null;
    charge?: string | { id: string } | null;
    metadata?: Record<string, string> | null;
  },
  opts?: { stripeRawJson?: Prisma.InputJsonValue }
): Promise<SyncRefundResult> {
  const stripeRefundId = refund.id;
  const piRaw = refund.payment_intent;
  const paymentIntentId =
    typeof piRaw === "string" ? piRaw : piRaw && typeof piRaw === "object" ? piRaw.id : null;
  const chargeRaw = refund.charge;
  const chargeId =
    typeof chargeRaw === "string" ? chargeRaw : chargeRaw && typeof chargeRaw === "object" ? chargeRaw.id : null;

  const metadata = refund.metadata ?? {};
  const orderIdFromMeta = metadata.orderId?.trim() || null;
  const vendorOrderIdFromMeta = metadata.vendorOrderId?.trim() || null;

  const existing = await prisma.orderRefund.findUnique({
    where: { stripeRefundId },
  });
  if (existing) {
    const nextStatus = mapStripeRefundStatus(refund.status);
    if (existing.status !== nextStatus || !existing.stripeRefundId) {
      if (nextStatus === ORDER_REFUND_SUCCEEDED_STATUS) {
        await markRefundSucceeded({
          orderRefundId: existing.id,
          stripeRefundId,
          stripeRawJson: opts?.stripeRawJson,
        });
      } else {
        await prisma.orderRefund.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            stripeRawJson: opts?.stripeRawJson ?? undefined,
          },
        });
      }
    }
    return { outcome: "synced", orderRefundId: existing.id };
  }

  let orderId = orderIdFromMeta;
  if (!orderId && paymentIntentId) {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true },
    });
    orderId = order?.id ?? null;
  }

  if (!orderId) {
    return { outcome: "unmatched", reason: "no_order_id_or_payment_intent_match" };
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, stripePaymentIntentId: true, stripeChargeId: true },
  });

  const idempotencyKey = `stripe_refund:${stripeRefundId}`;
  const pending = await prisma.orderRefund.findUnique({ where: { idempotencyKey } });
  if (pending) {
    const nextStatus = mapStripeRefundStatus(refund.status);
    if (nextStatus === ORDER_REFUND_SUCCEEDED_STATUS) {
      await markRefundSucceeded({
        orderRefundId: pending.id,
        stripeRefundId,
        stripeRawJson: opts?.stripeRawJson,
      });
    }
    return { outcome: "synced", orderRefundId: pending.id };
  }

  const linkedAttempt = await prisma.refundAttempt.findFirst({
    where: { stripeRefundId },
    select: { id: true, reason: true, vendorOrderId: true },
  });

  const status = mapStripeRefundStatus(refund.status);
  const row = await prisma.orderRefund.create({
    data: {
      orderId,
      vendorOrderId: vendorOrderIdFromMeta ?? linkedAttempt?.vendorOrderId ?? null,
      paymentId: payment?.id ?? null,
      refundAttemptId: linkedAttempt?.id ?? null,
      stripeRefundId: status === ORDER_REFUND_SUCCEEDED_STATUS ? stripeRefundId : null,
      stripePaymentIntentId: paymentIntentId ?? payment?.stripePaymentIntentId ?? "",
      stripeChargeId: chargeId ?? payment?.stripeChargeId ?? null,
      amountCents: refund.amount,
      currency: refund.currency ?? "usd",
      reason: linkedAttempt?.reason ?? metadata.reason ?? "stripe_webhook",
      status,
      refundScope: "legacy",
      initiatedByRole: "system",
      idempotencyKey,
      stripeRawJson: opts?.stripeRawJson ?? undefined,
      completedAt: status === ORDER_REFUND_SUCCEEDED_STATUS ? new Date() : null,
    },
  });

  if (status === ORDER_REFUND_SUCCEEDED_STATUS) {
    await markRefundSucceeded({
      orderRefundId: row.id,
      stripeRefundId,
      stripeRawJson: opts?.stripeRawJson,
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await refreshOrderRefundDenormalized(tx, orderId);
    });
  }

  return { outcome: "synced", orderRefundId: row.id };
}

/** Link ledger row to RefundAttempt after legacy flow creates the attempt first. */
export async function linkOrderRefundToRefundAttempt(args: {
  idempotencyKey: string;
  refundAttemptId: string;
}): Promise<string | null> {
  const row = await prisma.orderRefund.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
    select: { id: true, refundAttemptId: true },
  });
  if (!row) return null;
  if (row.refundAttemptId === args.refundAttemptId) return row.id;
  await prisma.orderRefund.update({
    where: { id: row.id },
    data: { refundAttemptId: args.refundAttemptId },
  });
  return row.id;
}
