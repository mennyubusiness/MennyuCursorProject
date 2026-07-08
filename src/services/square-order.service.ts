/**
 * Square order submission: map OO VendorOrder → Square Orders API + external payment record.
 * Customer payment remains on Stripe; Square receives EXTERNAL payment for POS visibility only.
 */
import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  createSquareExternalPayment,
  createSquareOrder,
  SquareApiError,
} from "@/lib/integrations/square/square-api.client";
import {
  ensureSquareAccessToken,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";
import { assertSquareOrderRoutingReady } from "@/lib/integrations/square/square-order-routing-readiness";
import {
  getVendorOrderForSquare,
  mapVendorOrderToSquareCreateOrder,
} from "@/lib/integrations/square/square-order-mapper";
import type { SquareOrderSubmitAudit } from "@/lib/integrations/square/square-order.types";
import { upsertProviderEntityMapping, hashProviderPayload } from "@/lib/integrations/provider-mapping.service";

const LOG_PREFIX = "[SquareOrder]";

export interface SubmitVendorOrderToSquareResult {
  success: boolean;
  squareOrderId?: string;
  error?: string;
  code?: "VALIDATION_FAILED" | "SUBMISSION_FAILED" | "ROUTING_NOT_READY";
  skipped?: boolean;
}

async function recordSquareRoutingFailure(
  vendorOrderId: string,
  error: string,
  extra?: {
    lastSquarePayload?: unknown;
    lastSquareResponse?: unknown;
  }
): Promise<void> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { routingStatus: true, squareAttempts: true },
  });
  if (!vo || vo.routingStatus !== "pending") return;

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: {
      squareAttempts: vo.squareAttempts + 1,
      squareLastError: error,
      routingStatus: "failed",
      ...(extra?.lastSquarePayload != null
        ? { lastSquarePayload: extra.lastSquarePayload as Prisma.InputJsonValue }
        : {}),
      ...(extra?.lastSquareResponse != null
        ? { lastSquareResponse: extra.lastSquareResponse as Prisma.InputJsonValue }
        : {}),
    },
  });

  const { createVendorOrderIssue, getVendorOrderIssues } = await import("@/services/issues.service");
  const existing = await getVendorOrderIssues(vendorOrderId, "OPEN");
  if (!existing.some((i) => i.type === "routing_failure")) {
    await createVendorOrderIssue(vendorOrderId, "routing_failure", "HIGH", {
      notes: error,
      createdBy: "system",
    });
  }
}

function squareOrderIdempotencyKey(vendorOrderId: string): string {
  return `oo:sq:order:${vendorOrderId}`;
}

function squarePaymentIdempotencyKey(vendorOrderId: string): string {
  return `oo:sq:pay:${vendorOrderId}`;
}

export async function submitVendorOrderToSquare(
  vendorOrderId: string,
  context: { customerPhone: string; customerEmail: string | null }
): Promise<SubmitVendorOrderToSquareResult> {
  const vendorOrder = await getVendorOrderForSquare(vendorOrderId);
  if (!vendorOrder) {
    return { success: false, error: "Vendor order not found" };
  }

  const current = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { routingStatus: true, squareOrderId: true },
  });
  if (current?.routingStatus === "sent" && current.squareOrderId) {
    console.info(
      `${LOG_PREFIX} Skip submit (already sent) vendorOrderId=${vendorOrderId} squareOrderId=${current.squareOrderId}`
    );
    return { success: true, squareOrderId: current.squareOrderId };
  }

  const readiness = await assertSquareOrderRoutingReady(vendorOrder.vendorId);
  if (!readiness.ok) {
    await recordSquareRoutingFailure(vendorOrderId, readiness.error);
    return {
      success: false,
      error: readiness.error,
      code: "ROUTING_NOT_READY",
    };
  }

  const connection = await getActiveSquareConnectionForVendor(vendorOrder.vendorId);
  if (!connection?.accessTokenRef) {
    const msg = "Square OAuth token missing.";
    await recordSquareRoutingFailure(vendorOrderId, msg);
    return { success: false, error: msg, code: "ROUTING_NOT_READY" };
  }

  const mapped = await mapVendorOrderToSquareCreateOrder({
    vendorOrder,
    locationId: readiness.locationId,
    idempotencyKey: squareOrderIdempotencyKey(vendorOrderId),
    customerDisplayName: context.customerEmail ?? context.customerPhone,
  });

  if (!mapped.ok) {
    const summary = mapped.issues.map((i) => i.message).join("; ");
    await recordSquareRoutingFailure(vendorOrderId, summary, {
      lastSquarePayload: { mappingIssues: mapped.issues },
    });
    return {
      success: false,
      error: summary,
      code: "VALIDATION_FAILED",
    };
  }

  const audit: SquareOrderSubmitAudit = {
    createOrderRequest: mapped.request,
  };

  if (env.SQUARE_ROUTING_LIVE !== "true") {
    console.info(
      `${LOG_PREFIX} Live routing disabled vendorOrderId=${vendorOrderId} (SQUARE_ROUTING_LIVE is not true)`
    );
    await prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: {
        lastSquarePayload: audit as unknown as Prisma.InputJsonValue,
        squareLastError: "SQUARE_ROUTING_LIVE is not enabled; payload built only.",
      },
    });
    return {
      success: false,
      error: "Square live routing is disabled in this environment.",
      skipped: true,
    };
  }

  const token = await ensureSquareAccessToken(connection);
  if (!token) {
    const msg = "Could not load Square access token.";
    await recordSquareRoutingFailure(vendorOrderId, msg);
    return { success: false, error: msg, code: "SUBMISSION_FAILED" };
  }

  try {
    const createRes = await createSquareOrder(token, mapped.request);
    audit.createOrderResponse = createRes;
    const squareOrderId = createRes.order?.id?.trim();
    if (!squareOrderId) {
      const msg = "Square create order response missing order id.";
      await recordSquareRoutingFailure(vendorOrderId, msg, {
        lastSquarePayload: audit,
        lastSquareResponse: createRes,
      });
      return { success: false, error: msg, code: "SUBMISSION_FAILED" };
    }

    const totalMoney = createRes.order?.total_money;
    const amount = totalMoney?.amount;
    const currency = totalMoney?.currency ?? "USD";
    if (amount == null || amount < 0) {
      const msg = "Square order total missing; cannot record external payment.";
      await recordSquareRoutingFailure(vendorOrderId, msg, {
        lastSquarePayload: audit,
        lastSquareResponse: createRes,
      });
      return { success: false, error: msg, code: "SUBMISSION_FAILED" };
    }

    const paymentReq = {
      idempotency_key: squarePaymentIdempotencyKey(vendorOrderId),
      source_id: "EXTERNAL" as const,
      order_id: squareOrderId,
      amount_money: { amount, currency },
      external_details: {
        type: "OTHER" as const,
        source: "Open Order",
      },
      autocomplete: true,
    };
    audit.createPaymentRequest = paymentReq;

    const paymentRes = await createSquareExternalPayment(token, paymentReq);
    audit.createPaymentResponse = paymentRes;

    const now = new Date();
    await prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: {
        squareOrderId,
        routingStatus: "sent",
        squareSubmittedAt: now,
        squareLastError: null,
        lastSquarePayload: audit as unknown as Prisma.InputJsonValue,
        lastSquareResponse: {
          createOrder: createRes,
          createPayment: paymentRes,
        } as unknown as Prisma.InputJsonValue,
        lastStatusSource: "system",
      },
    });

    await upsertProviderEntityMapping({
      vendorId: vendorOrder.vendorId,
      connectionId: connection.id,
      provider: "square",
      internalEntityType: "vendor_order",
      internalEntityId: vendorOrderId,
      externalId: squareOrderId,
      externalLocationId: readiness.locationId,
      externalPayloadHash: hashProviderPayload(audit),
      isActive: true,
    });

    console.info(
      `${LOG_PREFIX} Success vendorOrderId=${vendorOrderId} squareOrderId=${squareOrderId} lineItems=${mapped.lineItemCount}`
    );

    return { success: true, squareOrderId };
  } catch (e) {
    const message =
      e instanceof SquareApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Square order submission failed.";
    console.warn(`${LOG_PREFIX} Failure vendorOrderId=${vendorOrderId} error=${message}`);
    await recordSquareRoutingFailure(vendorOrderId, message, {
      lastSquarePayload: audit,
      lastSquareResponse:
        e instanceof SquareApiError ? { status: e.status, body: e.body } : { error: message },
    });
    return { success: false, error: message, code: "SUBMISSION_FAILED" };
  }
}
