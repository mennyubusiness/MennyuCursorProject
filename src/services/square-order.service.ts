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
  markSquareConnectionInsufficientPermissions,
} from "@/lib/integrations/square/square-connection.service";
import { assertSquareOrderRoutingReady } from "@/lib/integrations/square/square-order-routing-readiness";
import {
  isSquareInsufficientPermissionsError,
  SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE,
  SQUARE_ROUTING_PERMISSIONS_ERROR_CODE,
} from "@/lib/integrations/square/square-oauth-scopes";
import {
  extractSquareOrderIdFromAudit,
} from "@/lib/integrations/square/square-order-audit";
import {
  getVendorOrderForSquare,
  mapVendorOrderToSquareCreateOrder,
} from "@/lib/integrations/square/square-order-mapper";
import type { SquareOrderSubmitAudit } from "@/lib/integrations/square/square-order.types";
import {
  evaluateSquareOrderTotalComparison,
  SQUARE_TOTAL_MISMATCH_ADMIN_COPY,
} from "@/lib/integrations/square/square-order-total-comparison";
import { upsertProviderEntityMapping, hashProviderPayload } from "@/lib/integrations/provider-mapping.service";

const LOG_PREFIX = "[SquareOrder]";

export interface SubmitVendorOrderToSquareResult {
  success: boolean;
  squareOrderId?: string;
  error?: string;
  code?: "VALIDATION_FAILED" | "SUBMISSION_FAILED" | "ROUTING_NOT_READY" | typeof SQUARE_ROUTING_PERMISSIONS_ERROR_CODE;
  skipped?: boolean;
  totalMismatchWarning?: boolean;
}

function squareOrderIdempotencyKey(vendorOrderId: string): string {
  return `oo:sq:order:${vendorOrderId}`;
}

function squarePaymentIdempotencyKey(vendorOrderId: string): string {
  return `oo:sq:pay:${vendorOrderId}`;
}

function readStoredAudit(payload: unknown): SquareOrderSubmitAudit {
  if (payload != null && typeof payload === "object") {
    return payload as SquareOrderSubmitAudit;
  }
  return {};
}

function readCreateOrderResponse(
  audit: SquareOrderSubmitAudit,
  lastSquareResponse: unknown
): SquareOrderSubmitAudit["createOrderResponse"] {
  if (audit.createOrderResponse) return audit.createOrderResponse;
  if (lastSquareResponse != null && typeof lastSquareResponse === "object") {
    const response = lastSquareResponse as { createOrder?: SquareOrderSubmitAudit["createOrderResponse"] };
    return response.createOrder;
  }
  return undefined;
}

async function recordSquareRoutingFailure(
  vendorOrderId: string,
  error: string,
  extra?: {
    lastSquarePayload?: unknown;
    lastSquareResponse?: unknown;
    squareOrderId?: string | null;
  }
): Promise<void> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { routingStatus: true, squareAttempts: true, squareOrderId: true },
  });
  if (!vo) return;
  if (vo.routingStatus === "sent" && vo.squareOrderId) return;

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: {
      squareAttempts: vo.squareAttempts + 1,
      squareLastError: error,
      routingStatus: "failed",
      ...(extra?.squareOrderId?.trim() ? { squareOrderId: extra.squareOrderId.trim() } : {}),
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

async function persistSquareRoutingSuccess(input: {
  vendorOrderId: string;
  vendorId: string;
  connectionId: string;
  locationId: string;
  squareOrderId: string;
  audit: SquareOrderSubmitAudit;
  createOrderResponse: NonNullable<SquareOrderSubmitAudit["createOrderResponse"]>;
  createPaymentResponse: NonNullable<SquareOrderSubmitAudit["createPaymentResponse"]>;
}): Promise<void> {
  const now = new Date();
  await prisma.vendorOrder.update({
    where: { id: input.vendorOrderId },
    data: {
      squareOrderId: input.squareOrderId,
      routingStatus: "sent",
      squareSubmittedAt: now,
      squareLastError: null,
      lastSquarePayload: input.audit as unknown as Prisma.InputJsonValue,
      lastSquareResponse: {
        createOrder: input.createOrderResponse,
        createPayment: input.createPaymentResponse,
      } as unknown as Prisma.InputJsonValue,
      lastStatusSource: "system",
    },
  });

  await upsertProviderEntityMapping({
    vendorId: input.vendorId,
    connectionId: input.connectionId,
    provider: "square",
    internalEntityType: "vendor_order",
    internalEntityId: input.vendorOrderId,
    externalId: input.squareOrderId,
    externalLocationId: input.locationId,
    externalPayloadHash: hashProviderPayload(input.audit),
    isActive: true,
  });
}

async function persistPartialSquareOrder(input: {
  vendorOrderId: string;
  squareOrderId: string;
  audit: SquareOrderSubmitAudit;
  createOrderResponse: NonNullable<SquareOrderSubmitAudit["createOrderResponse"]>;
}): Promise<void> {
  await prisma.vendorOrder.update({
    where: { id: input.vendorOrderId },
    data: {
      squareOrderId: input.squareOrderId,
      lastSquarePayload: input.audit as unknown as Prisma.InputJsonValue,
      lastSquareResponse: {
        createOrder: input.createOrderResponse,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function submitSquareExternalPayment(input: {
  vendorOrderId: string;
  vendorId: string;
  connectionId: string;
  locationId: string;
  token: string;
  squareOrderId: string;
  amount: number;
  currency: string;
  audit: SquareOrderSubmitAudit;
  subtotalCents: number;
  taxCents: number;
  createOrderResponse: NonNullable<SquareOrderSubmitAudit["createOrderResponse"]>;
}): Promise<SubmitVendorOrderToSquareResult> {
  const paymentReq = {
    idempotency_key: squarePaymentIdempotencyKey(input.vendorOrderId),
    source_id: "EXTERNAL" as const,
    order_id: input.squareOrderId,
    amount_money: { amount: input.amount, currency: input.currency },
    external_details: {
      type: "OTHER" as const,
      source: "Open Order",
    },
    autocomplete: true,
  };

  input.audit.createPaymentRequest = paymentReq;

  try {
    const paymentRes = await createSquareExternalPayment(input.token, paymentReq);
    input.audit.createPaymentResponse = paymentRes;

    const reconciliation = evaluateSquareOrderTotalComparison({
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      squareOrderTotalCents: input.amount,
      squareExternalPaymentCents: input.amount,
    });
    input.audit.reconciliation = reconciliation;
    input.audit.squarePaymentId = paymentRes.payment?.id?.trim();
    input.audit.squarePaymentStatus = paymentRes.payment?.status?.trim();
    input.audit.squareOrderState = input.createOrderResponse.order?.state?.trim();

    if (reconciliation.mismatchBlocked) {
      const msg = `${SQUARE_TOTAL_MISMATCH_ADMIN_COPY} Difference: ${reconciliation.squareTotalDifferenceCents} cents.`;
      await recordSquareRoutingFailure(input.vendorOrderId, msg, {
        lastSquarePayload: input.audit,
        lastSquareResponse: {
          createOrder: input.createOrderResponse,
          createPayment: paymentRes,
        },
        squareOrderId: input.squareOrderId,
      });
      return {
        success: false,
        error: msg,
        code: "SUBMISSION_FAILED",
        totalMismatchWarning: true,
      };
    }

    await persistSquareRoutingSuccess({
      vendorOrderId: input.vendorOrderId,
      vendorId: input.vendorId,
      connectionId: input.connectionId,
      locationId: input.locationId,
      squareOrderId: input.squareOrderId,
      audit: input.audit,
      createOrderResponse: input.createOrderResponse,
      createPaymentResponse: paymentRes,
    });

    console.info(
      `${LOG_PREFIX} Success vendorOrderId=${input.vendorOrderId} squareOrderId=${input.squareOrderId}`
    );

    return {
      success: true,
      squareOrderId: input.squareOrderId,
      totalMismatchWarning: reconciliation.mismatchWarning,
    };
  } catch (e) {
    const rawMessage =
      e instanceof SquareApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Square external payment failed.";
    const permissionsError = isSquareInsufficientPermissionsError(rawMessage);
    const message = permissionsError ? SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE : rawMessage;

    if (permissionsError && input.connectionId) {
      await markSquareConnectionInsufficientPermissions(input.connectionId);
    }

    await recordSquareRoutingFailure(input.vendorOrderId, message, {
      lastSquarePayload: input.audit,
      lastSquareResponse:
        e instanceof SquareApiError ? { status: e.status, body: e.body } : { error: message },
      squareOrderId: input.squareOrderId,
    });

    return {
      success: false,
      error: message,
      code: permissionsError ? SQUARE_ROUTING_PERMISSIONS_ERROR_CODE : "SUBMISSION_FAILED",
    };
  }
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
    select: {
      routingStatus: true,
      squareOrderId: true,
      lastSquarePayload: true,
      lastSquareResponse: true,
      subtotalCents: true,
      taxCents: true,
    },
  });
  if (!current) {
    return { success: false, error: "Vendor order not found" };
  }

  if (current.routingStatus === "sent" && current.squareOrderId) {
    console.info(
      `${LOG_PREFIX} Skip submit (already sent) vendorOrderId=${vendorOrderId} squareOrderId=${current.squareOrderId}`
    );
    return { success: true, squareOrderId: current.squareOrderId };
  }

  const attemptAt = new Date().toISOString();
  const existingAudit = readStoredAudit(current.lastSquarePayload);
  existingAudit.squareLastAttemptAt = attemptAt;

  const readiness = await assertSquareOrderRoutingReady(vendorOrder.vendorId);
  if (!readiness.ok) {
    await recordSquareRoutingFailure(vendorOrderId, readiness.error, {
      lastSquarePayload: existingAudit,
    });
    return {
      success: false,
      error: readiness.error,
      code: "ROUTING_NOT_READY",
    };
  }

  const connection = await getActiveSquareConnectionForVendor(vendorOrder.vendorId);
  if (!connection?.accessTokenRef) {
    const msg = "Square OAuth token missing.";
    await recordSquareRoutingFailure(vendorOrderId, msg, { lastSquarePayload: existingAudit });
    return { success: false, error: msg, code: "ROUTING_NOT_READY" };
  }

  const token = await ensureSquareAccessToken(connection);
  if (!token) {
    const msg = "Could not load Square access token.";
    await recordSquareRoutingFailure(vendorOrderId, msg, { lastSquarePayload: existingAudit });
    return { success: false, error: msg, code: "SUBMISSION_FAILED" };
  }

  const existingSquareOrderId = extractSquareOrderIdFromAudit(
    current.squareOrderId,
    current.lastSquareResponse
  );

  if (existingSquareOrderId) {
    const createOrderResponse = readCreateOrderResponse(existingAudit, current.lastSquareResponse);
    const totalMoney = createOrderResponse?.order?.total_money;
    const amount = totalMoney?.amount;
    const currency = totalMoney?.currency ?? "USD";
    if (amount == null || amount < 0) {
      const msg = "Stored Square order is missing total_money; cannot retry external payment.";
      await recordSquareRoutingFailure(vendorOrderId, msg, {
        lastSquarePayload: existingAudit,
        squareOrderId: existingSquareOrderId,
      });
      return { success: false, error: msg, code: "SUBMISSION_FAILED" };
    }

    existingAudit.paymentOnlyRetry = true;
    return submitSquareExternalPayment({
      vendorOrderId,
      vendorId: vendorOrder.vendorId,
      connectionId: connection.id,
      locationId: readiness.locationId,
      token,
      squareOrderId: existingSquareOrderId,
      amount,
      currency,
      audit: existingAudit,
      subtotalCents: current.subtotalCents,
      taxCents: current.taxCents,
      createOrderResponse: createOrderResponse ?? { order: { id: existingSquareOrderId, total_money: { amount, currency } } },
    });
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
      lastSquarePayload: { ...existingAudit, mappingIssues: mapped.issues },
    });
    return {
      success: false,
      error: summary,
      code: "VALIDATION_FAILED",
    };
  }

  const audit: SquareOrderSubmitAudit = {
    ...existingAudit,
    createOrderRequest: mapped.request,
    squareLastAttemptAt: attemptAt,
  };

  if (env.SQUARE_ROUTING_LIVE !== "true") {
    console.info(
      `${LOG_PREFIX} Live routing disabled vendorOrderId=${vendorOrderId} (SQUARE_ROUTING_LIVE is not true)`
    );
    await recordSquareRoutingFailure(
      vendorOrderId,
      "Square routing is selected, but live Square API routing is disabled globally.",
      { lastSquarePayload: audit }
    );
    return {
      success: false,
      error: "Square live routing is disabled in this environment.",
      skipped: true,
    };
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

    audit.squareOrderState = createRes.order?.state?.trim();

    const totalMoney = createRes.order?.total_money;
    const amount = totalMoney?.amount;
    const currency = totalMoney?.currency ?? "USD";
    if (amount == null || amount < 0) {
      const msg = "Square order total missing; cannot record external payment.";
      await recordSquareRoutingFailure(vendorOrderId, msg, {
        lastSquarePayload: audit,
        lastSquareResponse: createRes,
        squareOrderId,
      });
      return { success: false, error: msg, code: "SUBMISSION_FAILED" };
    }

    await persistPartialSquareOrder({
      vendorOrderId,
      squareOrderId,
      audit,
      createOrderResponse: createRes,
    });

    return submitSquareExternalPayment({
      vendorOrderId,
      vendorId: vendorOrder.vendorId,
      connectionId: connection.id,
      locationId: readiness.locationId,
      token,
      squareOrderId,
      amount,
      currency,
      audit,
      subtotalCents: current.subtotalCents,
      taxCents: current.taxCents,
      createOrderResponse: createRes,
    });
  } catch (e) {
    const rawMessage =
      e instanceof SquareApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Square order submission failed.";
    const permissionsError = isSquareInsufficientPermissionsError(rawMessage);
    const message = permissionsError ? SQUARE_OAUTH_PERMISSIONS_ADMIN_MESSAGE : rawMessage;

    if (permissionsError && connection?.id) {
      await markSquareConnectionInsufficientPermissions(connection.id);
    }

    console.warn(`${LOG_PREFIX} Failure vendorOrderId=${vendorOrderId} error=${message}`);
    await recordSquareRoutingFailure(vendorOrderId, message, {
      lastSquarePayload: audit,
      lastSquareResponse:
        e instanceof SquareApiError ? { status: e.status, body: e.body } : { error: message },
    });
    return {
      success: false,
      error: message,
      code: permissionsError ? SQUARE_ROUTING_PERMISSIONS_ERROR_CODE : "SUBMISSION_FAILED",
    };
  }
}
