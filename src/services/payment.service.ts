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
  const key = buildIdempotencyKey("payment_intent", idempotencyKey);
  const existingPayment = await prisma.payment.findUnique({
    where: { idempotencyKey: key },
  });
  if (existingPayment?.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
    const secret = pi.client_secret;
    if (!secret) throw new Error("Missing client_secret");
    return { clientSecret: secret, paymentIntentId: pi.id };
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { orderId },
    },
    { idempotencyKey: key }
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
    allocations: { allocatedProcessingFeeCents: number }[];
  },
  stripePaymentIntentId: string
): Promise<void> {
  const liveFee = await fetchStripeProcessingFeeCents(stripePaymentIntentId);
  assertPaymentPayoutSnapshotMatchesLiveFee(payment, liveFee);
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
  const production = process.env.NODE_ENV === "production";
  if (
    production &&
    stripe &&
    !isDevBypassStripePaymentIntentId(stripePaymentIntentId) &&
    feeCents === null
  ) {
    throw new Error(
      "STRIPE_PROCESSING_FEE_UNAVAILABLE: missing balance_transaction.fee for PaymentIntent in production"
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
