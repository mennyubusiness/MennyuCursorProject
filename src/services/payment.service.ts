/**
 * Stripe payment: create PaymentIntent, confirm; create Payment + PaymentAllocation records.
 * Idempotency by idempotencyKey; payout snapshots (gross / allocated processing fee / net) at payment time.
 *
 * TODO(refund-payout): Do not recompute these snapshots on refund — later pass for reconciliation.
 */
import { addCents } from "@/domain/money";
import { computeVendorOrderPayoutSnapshots } from "@/domain/stripe-fee-allocation";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { assertPaymentPayoutSnapshotMatchesLiveFee } from "@/domain/payment-payout-snapshot";
import {
  fetchStripeProcessingFeeCents,
  isDevBypassStripePaymentIntentId,
} from "@/services/stripe-processing-fee.service";
import { fetchPaymentIntentChargeDetails } from "@/services/stripe-payment-charge-details.service";
import {
  ensureVendorPayoutTransferRecordsForPayment,
  ensureVendorPayoutTransferRecordsForPaymentInTx,
} from "@/services/vendor-payout-transfer.service";
import { ensurePodPayoutAllocationForPaymentInTx } from "@/services/pod-payout-allocation.service";

/** Development-only: bypass real Stripe when key is missing or placeholder. Not used in production. */
function isDevPaymentBypass(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.trim()) return true;
  if (/^sk_test_\.\.\.$/i.test(key.trim()) || key.trim() === "sk_test_...") return true;
  return !stripe;
}

export const ORDER_PAYMENT_CURRENCY = "usd";

export type PaymentIntentValidationResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404; code: string; message: string };

/**
 * Verifies a PaymentIntent belongs to the order before post-payment processing.
 * Used by POST /api/orders and processSuccessfulPayment (defense in depth).
 */
export async function validatePaymentIntentForOrderProcessing(params: {
  orderId: string;
  paymentIntentId: string;
}): Promise<PaymentIntentValidationResult> {
  const { orderId, paymentIntentId } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      totalCents: true,
      stripePaymentIntentId: true,
    },
  });
  if (!order) {
    return { ok: false, status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" };
  }

  if (isDevBypassStripePaymentIntentId(paymentIntentId)) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 403,
        code: "DEV_BYPASS_FORBIDDEN",
        message: "Development payment bypass is not available in production.",
      };
    }
    const expectedDevId = `dev_bypass_${orderId}`;
    if (paymentIntentId !== expectedDevId) {
      return {
        ok: false,
        status: 403,
        code: "PAYMENT_INTENT_ORDER_MISMATCH",
        message: "Payment does not match this order.",
      };
    }
    if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
      return {
        ok: false,
        status: 403,
        code: "PAYMENT_INTENT_ORDER_MISMATCH",
        message: "Payment does not match this order.",
      };
    }
    return { ok: true };
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { orderId: true },
  });
  if (existingPayment) {
    if (existingPayment.orderId !== orderId) {
      return {
        ok: false,
        status: 403,
        code: "PAYMENT_INTENT_ORDER_MISMATCH",
        message: "This payment belongs to a different order.",
      };
    }
    return { ok: true };
  }

  if (!stripe) {
    return {
      ok: false,
      status: 400,
      code: "STRIPE_NOT_CONFIGURED",
      message: "Stripe is not configured.",
    };
  }

  let pi: { metadata?: { orderId?: string }; amount: number; currency: string; status: string };
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return {
      ok: false,
      status: 400,
      code: "PAYMENT_INTENT_NOT_FOUND",
      message: "Payment could not be verified.",
    };
  }

  const metaOrderId = pi.metadata?.orderId;
  if (!metaOrderId || metaOrderId !== orderId) {
    return {
      ok: false,
      status: 403,
      code: "PAYMENT_INTENT_METADATA_MISMATCH",
      message: "Payment does not belong to this order.",
    };
  }

  if (pi.amount !== order.totalCents) {
    return {
      ok: false,
      status: 400,
      code: "PAYMENT_AMOUNT_MISMATCH",
      message: "Payment amount does not match this order.",
    };
  }

  if (pi.currency.toLowerCase() !== ORDER_PAYMENT_CURRENCY) {
    return {
      ok: false,
      status: 400,
      code: "PAYMENT_CURRENCY_MISMATCH",
      message: "Payment currency does not match this order.",
    };
  }

  if (pi.status !== "succeeded") {
    return {
      ok: false,
      status: 400,
      code: "PAYMENT_INTENT_NOT_SUCCEEDED",
      message: "Payment has not succeeded yet.",
    };
  }

  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
    return {
      ok: false,
      status: 403,
      code: "PAYMENT_INTENT_ORDER_MISMATCH",
      message: "Payment does not match this order.",
    };
  }

  return { ok: true };
}

/** PaymentIntent statuses where the customer can still complete or retry payment. */
export const REUSABLE_PAYMENT_INTENT_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
] as const;

export type StripePaymentIntentLike = {
  id: string;
  client_secret: string | null;
  amount: number;
  currency: string;
  status: string;
  metadata?: { orderId?: string };
};

export function isReusablePaymentIntentStatus(status: string): boolean {
  return (REUSABLE_PAYMENT_INTENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Reuse or update an existing order PaymentIntent when checkout is retried.
 * Returns null when a new PaymentIntent should be created (after canceling stale PI).
 */
export async function resolveExistingOrderPaymentIntent(params: {
  orderId: string;
  paymentIntentId: string;
  amountCents: number;
  currency?: string;
  retrieve?: (id: string) => Promise<StripePaymentIntentLike>;
  update?: (
    id: string,
    data: { amount: number; currency: string; metadata: { orderId: string } }
  ) => Promise<StripePaymentIntentLike>;
  cancel?: (id: string) => Promise<unknown>;
}): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  const currency = (params.currency ?? ORDER_PAYMENT_CURRENCY).toLowerCase();
  const retrieve = params.retrieve ?? ((id) => stripe.paymentIntents.retrieve(id));
  const update =
    params.update ??
    ((id, data) =>
      stripe.paymentIntents.update(id, {
        amount: data.amount,
        currency: data.currency,
        metadata: data.metadata,
      }));
  const cancel = params.cancel ?? ((id) => stripe.paymentIntents.cancel(id));

  let pi: StripePaymentIntentLike;
  try {
    pi = await retrieve(params.paymentIntentId);
  } catch {
    return null;
  }

  if (pi.metadata?.orderId !== params.orderId) {
    if (pi.status !== "succeeded" && pi.status !== "canceled") {
      try {
        await cancel(pi.id);
      } catch {
        // Best-effort cancel before replacement.
      }
    }
    return null;
  }

  if (pi.status === "succeeded") {
    return {
      clientSecret: pi.client_secret ?? "",
      paymentIntentId: pi.id,
    };
  }

  if (pi.status === "canceled") {
    return null;
  }

  if (isReusablePaymentIntentStatus(pi.status)) {
    if (pi.currency.toLowerCase() !== currency) {
      try {
        await cancel(pi.id);
      } catch {
        // Best-effort cancel before replacement.
      }
      return null;
    }
    if (pi.amount !== params.amountCents) {
      pi = await update(pi.id, {
        amount: params.amountCents,
        currency,
        metadata: { orderId: params.orderId },
      });
    }
    const secret = pi.client_secret;
    if (!secret) throw new Error("Missing client_secret");
    return { clientSecret: secret, paymentIntentId: pi.id };
  }

  if (pi.status !== "canceled") {
    try {
      await cancel(pi.id);
    } catch {
      // Best-effort cancel before replacement.
    }
  }
  return null;
}

async function cancelPaymentIntentIfLive(paymentIntentId: string): Promise<void> {
  if (!stripe) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "succeeded" || pi.status === "canceled") return;
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // Ignore — replacement path will create a fresh PaymentIntent.
  }
}

export async function createPaymentIntent(
  orderId: string,
  totalCents: number,
  idempotencyKey: string
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  // Development-only payment bypass when Stripe keys missing or placeholder.
  if (isDevPaymentBypass()) {
    const paymentIntentId = `dev_bypass_${orderId}`;
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentIntentId: paymentIntentId },
    });
    return { clientSecret: "dev_bypass", paymentIntentId };
  }

  if (!stripe) throw new Error("Stripe not configured");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, totalCents: true, stripePaymentIntentId: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending_payment") {
    throw new Error("Order is not awaiting payment");
  }

  const amountCents = order.totalCents;
  if (totalCents !== amountCents) {
    console.warn(
      JSON.stringify({
        event: "payment_intent_amount_param_mismatch",
        orderId,
        paramTotalCents: totalCents,
        orderTotalCents: amountCents,
      })
    );
  }

  if (order.stripePaymentIntentId) {
    const reused = await resolveExistingOrderPaymentIntent({
      orderId,
      paymentIntentId: order.stripePaymentIntentId,
      amountCents,
    });
    if (reused) {
      return reused;
    }
    await cancelPaymentIntentIfLive(order.stripePaymentIntentId);
  }

  const stripeIdempotencyKey = order.stripePaymentIntentId
    ? buildIdempotencyKey("payment_intent", `${orderId}:replace:${Date.now()}`)
    : buildIdempotencyKey("payment_intent", orderId);

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: ORDER_PAYMENT_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId },
    },
    { idempotencyKey: stripeIdempotencyKey }
  );

  await prisma.order.update({
    where: { id: orderId },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  const clientSecret = paymentIntent.client_secret;
  if (!clientSecret) throw new Error("Missing client_secret");
  return { clientSecret, paymentIntentId: paymentIntent.id };
}

/**
 * Resume Stripe PaymentElement for an unpaid order. Verifies phone matches; stable idempotency per order.
 */
export async function getResumePaymentPayloadForCustomer(params: {
  orderId: string;
  customerPhone: string;
}): Promise<{ clientSecret: string; paymentIntentId: string; totalCents: number } | null> {
  const normalized = params.customerPhone.trim();
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { customerPhone: true, status: true, totalCents: true },
  });
  if (!order || order.customerPhone.trim() !== normalized || order.status !== "pending_payment") {
    return null;
  }
  const { clientSecret, paymentIntentId } = await createPaymentIntent(
    params.orderId,
    order.totalCents,
    `resume_${params.orderId}`
  );
  return { clientSecret, paymentIntentId, totalCents: order.totalCents };
}

async function verifyExistingPaymentSnapshots(
  payment: {
    id: string;
    stripeProcessingFeeCents: number | null;
    stripePaymentIntentId: string;
    allocations: { allocatedProcessingFeeCents: number }[];
  },
  stripePaymentIntentId: string
): Promise<void> {
  const liveFee = await fetchStripeProcessingFeeCents(stripePaymentIntentId);
  assertPaymentPayoutSnapshotMatchesLiveFee(payment, liveFee);

  if (payment.stripeProcessingFeeCents === null && liveFee !== null) {
    try {
      await refreshDeferredPaymentStripeFeeSnapshot(payment.id);
    } catch (err) {
      console.warn(
        JSON.stringify({
          event: "payment_stripe_fee_backfill_failed",
          paymentId: payment.id,
          stripePaymentIntentId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
}

const DEFERRED_FEE_PAYOUT_STATUSES = new Set(["pending", "blocked"]);

/**
 * Backfill Payment.stripeProcessingFeeCents and allocation snapshots when Stripe fee was
 * unavailable at payment time. Safe to call from webhook replay or a future admin repair job.
 */
export async function refreshDeferredPaymentStripeFeeSnapshot(
  paymentId: string
): Promise<{ updated: boolean; reason?: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: { orderBy: { vendorOrderId: "asc" } },
    },
  });
  if (!payment) return { updated: false, reason: "payment_not_found" };
  if (payment.stripeProcessingFeeCents !== null) {
    return { updated: false, reason: "fee_already_recorded" };
  }

  const chargeDetails = await fetchPaymentIntentChargeDetails(payment.stripePaymentIntentId);
  const feeCents =
    chargeDetails?.feeCents ?? (await fetchStripeProcessingFeeCents(payment.stripePaymentIntentId));
  if (feeCents === null) return { updated: false, reason: "fee_still_unavailable" };

  const grosses = payment.allocations.map((a) => a.grossVendorPayableCents);
  const {
    allocatedProcessingFeeCents: allocatedCents,
    netVendorTransferCents: nets,
    zeroWeightWithPositiveFee,
  } = computeVendorOrderPayoutSnapshots(grosses, feeCents);
  if (zeroWeightWithPositiveFee) {
    throw new Error(
      "VENDOR_PAYABLE_WEIGHTS_ZERO: cannot backfill Stripe fee when all grossVendorPayableCents are 0"
    );
  }

  const feeToAllocate = feeCents;
  const sumAllocated = allocatedCents.reduce((a, b) => a + b, 0);
  if (sumAllocated !== feeToAllocate) {
    throw new Error(
      `INTERNAL_ALLOCATION_SUM_MISMATCH: sum=${sumAllocated} feeToAllocate=${feeToAllocate}`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        stripeProcessingFeeCents: feeCents,
        stripeChargeId: chargeDetails?.chargeId ?? payment.stripeChargeId,
        stripeBalanceTransactionId:
          chargeDetails?.balanceTransactionId ?? payment.stripeBalanceTransactionId,
      },
    });

    for (let i = 0; i < payment.allocations.length; i++) {
      const alloc = payment.allocations[i]!;
      const net = nets[i] ?? 0;
      await tx.paymentAllocation.update({
        where: { id: alloc.id },
        data: {
          allocatedProcessingFeeCents: allocatedCents[i]!,
          netVendorTransferCents: net,
        },
      });

      const transfer = await tx.vendorPayoutTransfer.findUnique({
        where: { paymentAllocationId: alloc.id },
      });
      if (
        transfer &&
        !transfer.stripeTransferId &&
        DEFERRED_FEE_PAYOUT_STATUSES.has(transfer.status)
      ) {
        await tx.vendorPayoutTransfer.update({
          where: { id: transfer.id },
          data: { amountCents: net },
        });
      }
    }
  });

  console.info(
    JSON.stringify({
      event: "payment_stripe_fee_backfilled",
      paymentId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeProcessingFeeCents: feeCents,
    })
  );

  return { updated: true };
}

export async function recordPaymentAndAllocations(
  orderId: string,
  stripePaymentIntentId: string,
  idempotencyKey: string
): Promise<{ created: boolean }> {
  const key = buildIdempotencyKey("payment", idempotencyKey);

  const existingByKey = await prisma.payment.findUnique({
    where: { idempotencyKey: key },
    include: { allocations: true },
  });
  if (existingByKey) {
    await verifyExistingPaymentSnapshots(existingByKey, stripePaymentIntentId);
    return { created: false };
  }

  const existingByPi = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    include: { allocations: true },
  });
  if (existingByPi) {
    await verifyExistingPaymentSnapshots(existingByPi, stripePaymentIntentId);
    return { created: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendorOrders: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending_payment") return { created: false }; // already processed

  const chargeDetails = await fetchPaymentIntentChargeDetails(stripePaymentIntentId);
  const feeCents =
    chargeDetails?.feeCents ?? (await fetchStripeProcessingFeeCents(stripePaymentIntentId));
  const feeDeferred =
    !isDevBypassStripePaymentIntentId(stripePaymentIntentId) &&
    stripe &&
    feeCents === null;
  if (feeDeferred) {
    console.warn(
      JSON.stringify({
        event: "payment_stripe_fee_deferred",
        orderId,
        stripePaymentIntentId,
        message:
          "Stripe balance_transaction fee unavailable; payment recorded with null fee snapshot for later reconciliation",
      })
    );
  }

  const grosses = order.vendorOrders.map((vo) =>
    addCents(vo.subtotalCents, vo.taxCents, vo.tipCents)
  );
  const feeToAllocate = feeCents ?? 0;
  const {
    allocatedProcessingFeeCents: allocatedCents,
    netVendorTransferCents: nets,
    zeroWeightWithPositiveFee,
  } = computeVendorOrderPayoutSnapshots(grosses, feeCents);
  if (zeroWeightWithPositiveFee) {
    const msg =
      "VENDOR_PAYABLE_WEIGHTS_ZERO: all grossVendorPayableCents are 0 but Stripe fee > 0; fix order line data";
    console.error(`[payment] ${msg}`, { orderId, stripePaymentIntentId, feeToAllocate });
    throw new Error(msg);
  }

  const sumAllocated = allocatedCents.reduce((a, b) => a + b, 0);
  if (sumAllocated !== feeToAllocate) {
    throw new Error(
      `INTERNAL_ALLOCATION_SUM_MISMATCH: sum=${sumAllocated} feeToAllocate=${feeToAllocate}`
    );
  }

  const amountCents = order.totalCents;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orderId,
        stripePaymentIntentId,
        amountCents,
        status: "succeeded",
        idempotencyKey: key,
        stripeProcessingFeeCents: feeCents,
        stripeChargeId: chargeDetails?.chargeId ?? null,
        stripeBalanceTransactionId: chargeDetails?.balanceTransactionId ?? null,
      },
    });
    for (let i = 0; i < order.vendorOrders.length; i++) {
      const vo = order.vendorOrders[i]!;
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          vendorOrderId: vo.id,
          subtotalCents: vo.subtotalCents,
          tipCents: vo.tipCents,
          taxCents: vo.taxCents,
          serviceFeeCents: vo.serviceFeeCents,
          totalCents: vo.totalCents,
          grossVendorPayableCents: grosses[i]!,
          allocatedProcessingFeeCents: allocatedCents[i]!,
          netVendorTransferCents: nets[i] ?? 0,
        },
      });
    }
    await ensureVendorPayoutTransferRecordsForPaymentInTx(tx, payment.id);
    await ensurePodPayoutAllocationForPaymentInTx(tx, {
      paymentId: payment.id,
      orderId: order.id,
      podId: order.podId,
      eligibleSubtotalCents: order.subtotalCents,
    });
  });
  return { created: true };
}

const REDIRECT_RECONCILE_IDEMPOTENCY_PREFIX = "redirect_reconcile_";

/**
 * Fallback: when user lands with ?payment=success but webhook hasn't run yet, verify PI with Stripe
 * and run the same post-payment flow as the webhook (payment, status, routing, SMS). Idempotent.
 */
export async function reconcilePaymentFromRedirect(orderId: string): Promise<{
  reconciled: boolean;
  error?: string;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, stripePaymentIntentId: true },
  });
  if (!order || order.status !== "pending_payment") return { reconciled: false };
  const piId = order.stripePaymentIntentId;
  if (!piId || piId.startsWith("dev_bypass_")) return { reconciled: false };
  if (!stripe) return { reconciled: false, error: "Stripe not configured" };

  let pi: { status: string };
  try {
    pi = await stripe.paymentIntents.retrieve(piId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { reconciled: false, error: msg };
  }
  if (pi.status !== "succeeded") return { reconciled: false };

  try {
    const { processSuccessfulPayment } = await import("@/services/post-payment.service");
    await processSuccessfulPayment({
      orderId,
      paymentIntentId: piId,
      idempotencyKey: `${REDIRECT_RECONCILE_IDEMPOTENCY_PREFIX}${orderId}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { reconciled: false, error: message };
  }
  return { reconciled: true };
}
