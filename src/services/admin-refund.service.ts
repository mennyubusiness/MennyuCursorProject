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
import { formatAdminRefundCapErrorMessage } from "@/lib/admin-refund-error-messages";
import {
  executeStripeRefundForAdmin,
  type RefundResult,
} from "@/services/refund.service";
import { prepareTransferReversalsForRefundAttempt } from "@/services/vendor-payout-transfer-reversal.service";
import {
  linkSupportIssueToOrderRefund,
  validateLinkedOrderIssueForAdminRefund,
} from "@/services/order-support-issue.service";

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
  /** When set, links OrderRefund to this customer OrderIssue after successful Stripe refund. */
  linkedOrderIssueId?: string | null;
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
  orderLineItemId?: string | null;
  quantity?: number;
  amountCents?: number;
  platformAbsorbsRefund?: boolean;
  includeTax?: boolean;
  includeTip?: boolean;
  includeServiceFee?: boolean;
  linkedOrderIssueId?: string | null;
};

async function linkedIssueHasCustomerMessage(
  orderId: string,
  linkedOrderIssueId: string | null | undefined
): Promise<boolean> {
  if (!linkedOrderIssueId?.trim()) return false;
  const issue = await prisma.orderIssue.findFirst({
    where: { id: linkedOrderIssueId.trim(), orderId },
    select: { customerMessage: true },
  });
  return Boolean(issue?.customerMessage?.trim());
}

async function executeAdminRefundInternal(
  input: ExecuteAdminRefundInternalInput
): Promise<AdminRefundResult> {
  await assertAdminCanExecuteRefund(input.adminUserId);

  const issueHasCustomerMessage = await linkedIssueHasCustomerMessage(
    input.orderId,
    input.linkedOrderIssueId
  );

  const plan = await buildRefundExecutionPlan({
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    orderLineItemId: input.orderLineItemId ?? null,
    quantity: input.quantity ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
    includeTax: input.includeTax,
    includeTip: input.includeTip,
    includeServiceFee: input.includeServiceFee,
    linkedIssueHasCustomerMessage: issueHasCustomerMessage,
  });

  if (!plan) {
    throw new AdminRefundError("ORDER_NOT_FOUND", "Order not found.");
  }

  const allowed = assertRefundIsAllowed(plan, {
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    orderLineItemId: input.orderLineItemId ?? null,
    quantity: input.quantity ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
    includeTax: input.includeTax,
    includeTip: input.includeTip,
    includeServiceFee: input.includeServiceFee,
    linkedIssueHasCustomerMessage: issueHasCustomerMessage,
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

  const linkedOrderIssueId = input.linkedOrderIssueId?.trim() || null;
  if (linkedOrderIssueId) {
    const issueCheck = await validateLinkedOrderIssueForAdminRefund({
      orderId: input.orderId,
      linkedOrderIssueId,
      refundScope: input.scope,
      refundVendorOrderId: input.vendorOrderId ?? plan.vendorOrderId ?? null,
      refundOrderLineItemId: input.orderLineItemId ?? plan.lineItem?.orderLineItemId ?? null,
    });
    if (!issueCheck.ok) {
      throw new AdminRefundError(issueCheck.code, issueCheck.message);
    }
  }

  return runAdminRefundExecution({
    plan,
    adminUserId: input.adminUserId,
    reason: input.reason.trim(),
    adminNote: input.adminNote?.trim() || null,
    customerVisibleNote: input.customerVisibleNote?.trim() || null,
    linkedOrderIssueId,
    skipTransferReversal: Boolean(
      input.scope === "line_item_refund" ||
        (input.platformAbsorbsRefund && input.scope === "custom_vendor_partial")
    ),
    refundLineItem: plan.lineItem
      ? {
          ...plan.lineItem,
          vendorOrderId: plan.vendorOrderId!,
          amountCents: plan.customerRefundAmountCents,
        }
      : undefined,
    linkedOrderIssueIdForMetadata: linkedOrderIssueId,
  });
}

async function mapRefundCapErrorToAdmin(
  error: unknown,
  orderId: string
): Promise<AdminRefundError> {
  const message = error instanceof Error ? error.message : String(error);
  if (
    !message.includes("REFUND_EXCEEDS_ORDER_REMAINING") &&
    !message.includes("REFUND_EXCEEDS_VENDOR_ORDER_REMAINING")
  ) {
    throw error instanceof Error ? error : new Error(message);
  }

  const summary = await getOrderRefundSummary(orderId);
  if (summary?.hasPendingRefund) {
    return new AdminRefundError(
      "REFUND_IN_PROGRESS",
      formatAdminRefundCapErrorMessage({ code: "REFUND_IN_PROGRESS" })
    );
  }
  if (
    summary &&
    summary.remainingRefundableCents <= 0 &&
    summary.totalRefundedCents >= summary.paymentAmountCents
  ) {
    return new AdminRefundError(
      "ORDER_ALREADY_FULLY_REFUNDED",
      formatAdminRefundCapErrorMessage({ code: "ORDER_ALREADY_FULLY_REFUNDED" })
    );
  }
  return new AdminRefundError(
    "REFUND_AVAILABILITY_CHANGED",
    formatAdminRefundCapErrorMessage({ code: "REFUND_AVAILABILITY_CHANGED" })
  );
}

async function runAdminRefundExecution(args: {
  plan: RefundExecutionPlan;
  adminUserId: string;
  reason: string;
  adminNote: string | null;
  customerVisibleNote: string | null;
  linkedOrderIssueId?: string | null;
  linkedOrderIssueIdForMetadata?: string | null;
  skipTransferReversal: boolean;
  refundLineItem?: {
    orderLineItemId: string;
    vendorOrderId: string;
    quantityRefunded: number;
    subtotalRefundedCents: number;
    taxRefundedCents: number;
    tipRefundedCents: number;
    serviceFeeRefundedCents: number;
    amountCents: number;
  };
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
  if (
    existingLedger &&
    (existingLedger.status === "pending" || existingLedger.status === "requires_action")
  ) {
    throw new AdminRefundError(
      "REFUND_IN_PROGRESS",
      formatAdminRefundCapErrorMessage({ code: "REFUND_IN_PROGRESS" })
    );
  }

  let refundAttemptId: string;
  const existingAttempt = await prisma.refundAttempt.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, stripeRefundId: true },
  });

  if (existingAttempt?.status === "succeeded") {
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
  if (existingAttempt?.status === "attempted") {
    throw new AdminRefundError(
      "REFUND_IN_PROGRESS",
      formatAdminRefundCapErrorMessage({ code: "REFUND_IN_PROGRESS" })
    );
  }

  let orderRefundId: string;
  try {
    const pending = await recordPendingRefund({
      orderId: plan.orderId,
      vendorOrderId: plan.vendorOrderId,
      amountCents,
      idempotencyKey,
      reason: args.reason,
      refundScope: plan.refundScope,
      initiatedByRole: "admin",
      initiatedByUserId: args.adminUserId,
      stripePaymentIntentId: plan.stripePaymentIntentId!,
      stripeChargeId: plan.stripeChargeId,
      paymentId: plan.paymentId,
      adminNote: args.adminNote,
      customerVisibleNote: args.customerVisibleNote,
    });
    orderRefundId = pending.id;
  } catch (e) {
    throw await mapRefundCapErrorToAdmin(e, plan.orderId);
  }

  if (existingAttempt) {
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
      if (again.status === "attempted") {
        throw new AdminRefundError(
          "REFUND_IN_PROGRESS",
          formatAdminRefundCapErrorMessage({ code: "REFUND_IN_PROGRESS" })
        );
      }
      refundAttemptId = again.id;
    }
  }

  await prisma.orderRefund.update({
    where: { id: orderRefundId },
    data: { refundAttemptId },
  });

  await linkOrderRefundToRefundAttempt({
    idempotencyKey,
    refundAttemptId,
  });

  if (args.refundLineItem) {
    await prisma.refundLineItem.create({
      data: {
        orderRefundId,
        orderLineItemId: args.refundLineItem.orderLineItemId,
        vendorOrderId: args.refundLineItem.vendorOrderId,
        quantityRefunded: args.refundLineItem.quantityRefunded,
        subtotalRefundedCents: args.refundLineItem.subtotalRefundedCents,
        taxRefundedCents: args.refundLineItem.taxRefundedCents,
        tipRefundedCents: args.refundLineItem.tipRefundedCents,
        serviceFeeRefundedCents: args.refundLineItem.serviceFeeRefundedCents,
        amountCents: args.refundLineItem.amountCents,
      },
    });
  }

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
      orderLineItemId: args.refundLineItem?.orderLineItemId ?? null,
      orderRefundId,
      refundScope: plan.refundScope,
      reason: args.reason,
      linkedOrderIssueId: args.linkedOrderIssueIdForMetadata ?? null,
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

  if (args.linkedOrderIssueId) {
    await linkSupportIssueToOrderRefund({
      orderId: plan.orderId,
      orderRefundId,
      issueId: args.linkedOrderIssueId,
      requireRefundSucceeded: true,
    });
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
  orderLineItemId?: string | null;
  orderRefundId: string;
  refundScope: OrderRefundScope;
  reason: string;
  linkedOrderIssueId?: string | null;
}): Record<string, string> {
  return {
    orderId: input.orderId,
    orderRefundId: input.orderRefundId,
    refundScope: input.refundScope,
    reason: input.reason,
    initiatedByRole: "admin",
    ...(input.vendorOrderId ? { vendorOrderId: input.vendorOrderId } : {}),
    ...(input.orderLineItemId ? { orderLineItemId: input.orderLineItemId } : {}),
    ...(input.linkedOrderIssueId ? { linkedOrderIssueId: input.linkedOrderIssueId } : {}),
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

export async function executeAdminLineItemRefund(
  input: AdminRefundBaseInput & {
    vendorOrderId: string;
    orderLineItemId: string;
    quantity: number;
    includeTax?: boolean;
    includeTip?: boolean;
    includeServiceFee?: boolean;
    platformAbsorbsRefund?: boolean;
  }
): Promise<AdminRefundResult> {
  return executeAdminRefundInternal({
    ...input,
    scope: "line_item_refund",
    includeTax: input.includeTax,
    includeTip: input.includeTip,
    includeServiceFee: input.includeServiceFee,
    platformAbsorbsRefund: input.platformAbsorbsRefund ?? false,
  });
}

export async function previewAdminRefund(input: {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId?: string | null;
  orderLineItemId?: string | null;
  quantity?: number | null;
  amountCents?: number | null;
  reason: string;
  adminNote?: string | null;
  platformAbsorbsRefund?: boolean;
  includeTax?: boolean;
  includeTip?: boolean;
  includeServiceFee?: boolean;
  linkedOrderIssueId?: string | null;
}) {
  const issueHasCustomerMessage = await linkedIssueHasCustomerMessage(
    input.orderId,
    input.linkedOrderIssueId
  );
  return buildRefundExecutionPlan({
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId ?? null,
    orderLineItemId: input.orderLineItemId ?? null,
    quantity: input.quantity ?? null,
    amountCents: input.amountCents ?? null,
    reason: input.reason,
    adminNote: input.adminNote,
    platformAbsorbsRefund: input.platformAbsorbsRefund,
    includeTax: input.includeTax,
    includeTip: input.includeTip,
    includeServiceFee: input.includeServiceFee,
    linkedIssueHasCustomerMessage: issueHasCustomerMessage,
  });
}

export { buildAdminRefundIdempotencyKey };
