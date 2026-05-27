/**
 * Admin-only refund execution (Phase 2). Uses refund-calculation + refund-ledger + Stripe.
 */
import "server-only";

import type { OrderRefundScope } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  buildAdminRefundIdempotencyKey,
  buildAdminStripeRefundIdempotencyKey,
  type AdminRefundScopeKey,
} from "@/lib/admin-refund-idempotency";
import {
  assertRefundIsAllowed,
  buildRefundExecutionPlan,
  type RefundExecutionPlan,
} from "@/services/refund-calculation.service";
import {
  getOrderRefundSummary,
  getRemainingOrderRefundableCents,
  getRemainingVendorOrderRefundableCents,
  linkOrderRefundToRefundAttempt,
  recordPendingRefund,
} from "@/services/refund-ledger.service";
import {
  executeStripeRefundForAdmin,
  type RefundResult,
} from "@/services/refund.service";
import { prepareTransferReversalsForRefundAttempt } from "@/services/vendor-payout-transfer-reversal.service";

export class AdminRefundError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly blockingReasons?: string[]
  ) {
    super(message);
    this.name = "AdminRefundError";
  }
}

export type AdminRefundBaseInput = {
  orderId: string;
  adminUserId: string;
  reason: string;
  adminNote?: string | null;
  customerVisibleNote?: string | null;
};

export type AdminRefundResult = {
  success: boolean;
  code?: string;
  message: string;
  idempotent?: boolean;
  orderRefundId?: string;
  refundAttemptId?: string;
  stripeRefundId?: string;
  amountCents?: number;
  transferReversal?: {
    outcome: string;
    reason?: string;
    createdCount?: number;
  };
  refundSummary?: Awaited<ReturnType<typeof getOrderRefundSummary>>;
};

/** Platform admin session user, or dev admin-bridge sentinel. */
export async function assertAdminCanExecuteRefund(adminUserId: string): Promise<void> {
  if (env.NODE_ENV === "development" && adminUserId === "admin-bridge") {
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isPlatformAdmin: true },
  });
  if (!user?.isPlatformAdmin) {
    throw new AdminRefundError("FORBIDDEN", "Only platform admins can execute refunds.");
  }
}

type ExecuteAdminRefundInternalInput = AdminRefundBaseInput & {
  scope: AdminRefundScopeKey;
  vendorOrderId?: string | null;
  amountCents?: number;
  platformAbsorbsRefund?: boolean;
};

async function executeAdminRefundInternal(
  input: ExecuteAdminRefundInternalInput
): Promise<AdminRefundResult> {
  await assertAdminCanExecuteRefund(input.adminUserId);

  const plan = await buildRefundExecutionPlan({
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
  });

  if (!plan) {
    throw new AdminRefundError("ORDER_NOT_FOUND", "Order not found.");
  }

  const allowed = assertRefundIsAllowed(plan, {
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
  });

  if (!allowed.allowed) {
    throw new AdminRefundError(
      "REFUND_BLOCKED",
      "Refund is not allowed.",
      allowed.blockingReasons
    );
  }

  if (!plan.stripePaymentIntentId?.trim()) {
    throw new AdminRefundError("NO_PAYMENT_INTENT", "Order has no payment intent.");
  }

  return runAdminRefundExecution({
    plan,
    adminUserId: input.adminUserId,
    reason: input.reason.trim(),
    adminNote: input.adminNote?.trim() || null,
    customerVisibleNote: input.customerVisibleNote?.trim() || null,
    skipTransferReversal: Boolean(
      input.platformAbsorbsRefund && input.scope === "custom_vendor_partial"
    ),
  });
}

async function runAdminRefundExecution(args: {
  plan: RefundExecutionPlan;
  adminUserId: string;
  reason: string;
  adminNote: string | null;
  customerVisibleNote: string | null;
  skipTransferReversal: boolean;
}): Promise<AdminRefundResult> {
  const { plan } = args;
  const amountCents = plan.customerRefundAmountCents;
  const idempotencyKey = plan.idempotencyKey;

  const existingLedger = await prisma.orderRefund.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, stripeRefundId: true, refundAttemptId: true },
  });
  if (existingLedger?.status === "succeeded") {
    const summary = await getOrderRefundSummary(plan.orderId);
    return {
      success: true,
      idempotent: true,
      message: "Refund already succeeded (idempotent).",
      orderRefundId: existingLedger.id,
      refundAttemptId: existingLedger.refundAttemptId ?? undefined,
      stripeRefundId: existingLedger.stripeRefundId ?? undefined,
      amountCents,
      refundSummary: summary ?? undefined,
    };
  }

  let refundAttemptId: string;
  const existingAttempt = await prisma.refundAttempt.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, stripeRefundId: true },
  });

  if (existingAttempt) {
    if (existingAttempt.status === "succeeded") {
      const summary = await getOrderRefundSummary(plan.orderId);
      return {
        success: true,
        idempotent: true,
        message: "Refund attempt already succeeded.",
        refundAttemptId: existingAttempt.id,
        stripeRefundId: existingAttempt.stripeRefundId ?? undefined,
        amountCents,
        refundSummary: summary ?? undefined,
      };
    }
    if (existingAttempt.status === "attempted") {
      throw new AdminRefundError(
        "REFUND_IN_PROGRESS",
        "A refund for this idempotency key is already in progress."
      );
    }
    await prisma.refundAttempt.update({
      where: { id: existingAttempt.id },
      data: {
        status: "attempted",
        failureCode: null,
        failureMessage: null,
        updatedAt: new Date(),
      },
    });
    refundAttemptId = existingAttempt.id;
  } else {
    try {
      const created = await prisma.refundAttempt.create({
        data: {
          idempotencyKey,
          orderId: plan.orderId,
          vendorOrderId: plan.vendorOrderId,
          amountCents,
          status: "attempted",
          reason: args.reason,
        },
        select: { id: true },
      });
      refundAttemptId = created.id;
    } catch (e: unknown) {
      const isUnique =
        e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
      if (!isUnique) throw e;
      const again = await prisma.refundAttempt.findUnique({
        where: { idempotencyKey },
        select: { id: true, status: true },
      });
      if (!again) throw e;
      refundAttemptId = again.id;
    }
  }

  const pending = await recordPendingRefund({
    orderId: plan.orderId,
    vendorOrderId: plan.vendorOrderId,
    amountCents,
    idempotencyKey,
    reason: args.reason,
    refundScope: plan.refundScope,
    initiatedByRole: "admin",
    initiatedByUserId: args.adminUserId,
    refundAttemptId,
    stripePaymentIntentId: plan.stripePaymentIntentId!,
    stripeChargeId: plan.stripeChargeId,
    paymentId: plan.paymentId,
    adminNote: args.adminNote,
    customerVisibleNote: args.customerVisibleNote,
  });

  await linkOrderRefundToRefundAttempt({
    idempotencyKey,
    refundAttemptId,
  });

  const orderRefundId = pending.id;

  const stripeResult = await executeStripeRefundForAdmin({
    orderRefundId,
    refundAttemptId,
    orderId: plan.orderId,
    vendorOrderId: plan.vendorOrderId,
    amountCents,
    stripePaymentIntentId: plan.stripePaymentIntentId!,
    stripeIdempotencyKey: buildAdminStripeRefundIdempotencyKey(idempotencyKey),
    metadata: buildAdminStripeMetadata({
      orderId: plan.orderId,
      vendorOrderId: plan.vendorOrderId,
      orderRefundId,
      refundScope: plan.refundScope,
      reason: args.reason,
    }),
  });

  let transferReversal: AdminRefundResult["transferReversal"];
  if (stripeResult.success && !args.skipTransferReversal) {
    transferReversal = await prepareTransferReversalsAfterAdminRefund(refundAttemptId);
  } else if (stripeResult.success && args.skipTransferReversal) {
    transferReversal = {
      outcome: "skipped",
      reason: "platform_absorbs_refund_no_transfer_reversal",
    };
  }

  const summary = await getOrderRefundSummary(plan.orderId);

  if (!stripeResult.success) {
    return {
      success: false,
      code: stripeResult.code,
      message: stripeResult.message,
      orderRefundId,
      refundAttemptId,
      amountCents,
      transferReversal,
      refundSummary: summary ?? undefined,
    };
  }

  return {
    success: true,
    message:
      transferReversal?.outcome === "skipped" && transferReversal.reason?.includes("ineligible")
        ? "Customer refund succeeded; transfer reversal was not prepared (see transferReversal)."
        : transferReversal?.outcome === "skipped" &&
            transferReversal.reason?.includes("no_paid")
          ? "Customer refund succeeded; no paid vendor transfers to reverse."
          : transferReversal?.createdCount === 0 &&
              plan.transferReversalRequired &&
              !args.skipTransferReversal
            ? "Customer refund succeeded; transfer reversal preparation did not create rows."
            : "Refund succeeded.",
    orderRefundId,
    refundAttemptId,
    stripeRefundId: stripeResult.refundId,
    amountCents,
    transferReversal,
    refundSummary: summary ?? undefined,
  };
}

function buildAdminStripeMetadata(input: {
  orderId: string;
  vendorOrderId: string | null;
  orderRefundId: string;
  refundScope: OrderRefundScope;
  reason: string;
}): Record<string, string> {
  return {
    orderId: input.orderId,
    orderRefundId: input.orderRefundId,
    refundScope: input.refundScope,
    reason: input.reason,
    initiatedByRole: "admin",
    ...(input.vendorOrderId ? { vendorOrderId: input.vendorOrderId } : {}),
  };
}

async function prepareTransferReversalsAfterAdminRefund(
  refundAttemptId: string
): Promise<AdminRefundResult["transferReversal"]> {
  try {
    const r = await prepareTransferReversalsForRefundAttempt(refundAttemptId);
    return {
      outcome: r.outcome,
      reason: r.reason,
      createdCount: r.createdCount,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      JSON.stringify({
        event: "admin_refund_transfer_reversal_prep_failed",
        refundAttemptId,
        message: msg,
      })
    );
    return { outcome: "error", reason: msg };
  }
}

export async function executeAdminFullOrderRefund(
  input: AdminRefundBaseInput
): Promise<AdminRefundResult> {
  const remaining = await getRemainingOrderRefundableCents(input.orderId);
  return executeAdminRefundInternal({
    ...input,
    scope: "full_order",
    vendorOrderId: null,
    amountCents: remaining,
  });
}

export async function executeAdminFullVendorOrderRefund(
  input: AdminRefundBaseInput & { vendorOrderId: string }
): Promise<AdminRefundResult> {
  const remaining = await getRemainingVendorOrderRefundableCents(input.vendorOrderId);
  return executeAdminRefundInternal({
    ...input,
    scope: "full_vendor_order",
    amountCents: remaining,
  });
}

export async function executeAdminCustomVendorOrderRefund(
  input: AdminRefundBaseInput & {
    vendorOrderId: string;
    amountCents: number;
    platformAbsorbsRefund?: boolean;
  }
): Promise<AdminRefundResult> {
  return executeAdminRefundInternal({
    ...input,
    scope: "custom_vendor_partial",
    platformAbsorbsRefund: input.platformAbsorbsRefund ?? false,
  });
}

export async function previewAdminRefund(input: {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId?: string | null;
  amountCents?: number | null;
  reason: string;
  adminNote?: string | null;
  platformAbsorbsRefund?: boolean;
}) {
  return buildRefundExecutionPlan({
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
  });
}

export { buildAdminRefundIdempotencyKey };
