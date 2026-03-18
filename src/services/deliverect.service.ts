/**
 * Deliverect submission boundary: load → validate (live only) → transform → submit (when gated) → persist audit.
 * Live submission is gated by ROUTING_MODE=deliverect; mock mode only audits payload.
 * One VendorOrder at a time; retry-safe status transitions; full request/response audit.
 * Idempotent: if VO is already "sent" with deliverectOrderId, skips API call and returns success.
 *
 * First sandbox vendor: set Vendor.deliverectChannelLinkId (and optionally deliverectLocationId).
 * Ensure every MenuItem used in orders has deliverectProductId; every ModifierOption has deliverectModifierId.
 * Set DELIVERECT_API_URL to sandbox base if needed; ROUTING_MODE=deliverect to enable submission.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { submitOrder, type DeliverectResponseAudit } from "@/integrations/deliverect/client";
import { getVendorOrderForDeliverect } from "@/integrations/deliverect/load";
import { mennyuVendorOrderToDeliverectPayload } from "@/integrations/deliverect/transform";
import { validateForSubmission } from "@/integrations/deliverect/validate";

const LOG_PREFIX = "[Deliverect]";

export interface SubmitVendorOrderResult {
  success: boolean;
  deliverectOrderId?: string;
  error?: string;
  /** VALIDATION_FAILED = missing identifiers; SUBMISSION_FAILED = API or transport error. */
  code?: "VALIDATION_FAILED" | "SUBMISSION_FAILED";
  /** True when submission was skipped (e.g. ROUTING_MODE=mock). */
  skipped?: boolean;
}

export async function submitVendorOrderToDeliverect(
  vendorOrderId: string,
  customerPhone: string,
  customerEmail: string | null,
  preparationTimeMinutes?: number
): Promise<SubmitVendorOrderResult> {
  const vendorOrder = await getVendorOrderForDeliverect(vendorOrderId);
  if (!vendorOrder) {
    return { success: false, error: "Vendor order not found" };
  }

  const channelLinkId = vendorOrder.vendor.deliverectChannelLinkId ?? vendorOrder.deliverectChannelLinkId;

  // Idempotency: avoid duplicate submission for the same vendor order.
  const current = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { routingStatus: true, deliverectOrderId: true },
  });
  if (current?.routingStatus === "sent" && current.deliverectOrderId) {
    console.info(
      `${LOG_PREFIX} Skip submit (already sent) vendorOrderId=${vendorOrderId} vendorId=${vendorOrder.vendor.id} deliverectOrderId=${current.deliverectOrderId}`
    );
    return {
      success: true,
      deliverectOrderId: current.deliverectOrderId,
    };
  }

  // Validate required Deliverect identifiers before building payload (live mode only).
  // Mock mode skips validation so devs can build and audit payloads with placeholder IDs.
  if (env.ROUTING_MODE === "deliverect") {
    const validation = validateForSubmission(vendorOrder, channelLinkId);
    if (!validation.valid) {
      console.warn(
        `${LOG_PREFIX} Validation failed vendorOrderId=${vendorOrderId} vendorId=${vendorOrder.vendor.id} error=${validation.error}`
      );
      return {
        success: false,
        error: validation.error,
        code: "VALIDATION_FAILED",
      };
    }
  }

  if (!channelLinkId || String(channelLinkId).trim() === "") {
    return {
      success: false,
      error: "Vendor has no Deliverect channel link ID; cannot submit.",
      code: "VALIDATION_FAILED",
    };
  }

  const payload = mennyuVendorOrderToDeliverectPayload({
    vendorOrder,
    channelLinkId,
    locationId: vendorOrder.vendor.deliverectLocationId ?? undefined,
    customerPhone,
    customerEmail,
    preparationTimeMinutes,
  });

  const now = new Date();
  let result:
    | Awaited<ReturnType<typeof submitOrder>>
    | { success: false; error: string; raw: object; responseAudit?: DeliverectResponseAudit };

  if (env.ROUTING_MODE === "mock") {
    result = {
      success: false,
      error: "ROUTING_MODE=mock: live submission disabled",
      raw: { _mock: true, message: "Submission skipped; payload built and audited only." },
    };
    console.info(
      `${LOG_PREFIX} Mock mode vendorOrderId=${vendorOrderId} vendorId=${vendorOrder.vendor.id} (payload not sent)`
    );
  } else {
    console.info(
      `${LOG_PREFIX} Submitting vendorOrderId=${vendorOrderId} vendorId=${vendorOrder.vendor.id} vendorName=${vendorOrder.vendor.name} channelLinkId=****${String(channelLinkId).slice(-4)}`
    );
    result = await submitOrder(payload);
    if (result.success) {
      if (result.acceptedWithoutExternalId) {
        console.info(
          `${LOG_PREFIX} Deliverect accepted (HTTP 2xx, empty/minimal body) vendorOrderId=${vendorOrderId} channelOrderId=${payload.channelOrderDisplayId} — no synchronous deliverectOrderId; webhook reconciliation pending`
        );
      } else {
        console.info(
          `${LOG_PREFIX} Confirmed success vendorOrderId=${vendorOrderId} deliverectOrderId=${result.externalOrderId}`
        );
      }
    } else {
      console.warn(
        `${LOG_PREFIX} Failure vendorOrderId=${vendorOrderId} error=${result.error ?? "unknown"} (see lastDeliverectResponse: body + responseHeaders)`
      );
    }
  }

  let responsePayload:
    | {
        httpStatus?: number;
        responseHeaders?: Record<string, string>;
        body?: unknown;
        _mennyu?: { deliverectOrderIdPendingWebhook: boolean };
      }
    | null =
    result.responseAudit != null
      ? {
          httpStatus: result.responseAudit.httpStatus,
          responseHeaders: result.responseAudit.responseHeaders,
          body: result.responseAudit.body,
        }
      : result.raw != null
        ? { body: result.raw }
        : null;
  if (
    responsePayload != null &&
    "acceptedWithoutExternalId" in result &&
    result.acceptedWithoutExternalId
  ) {
    responsePayload = {
      ...responsePayload,
      _mennyu: { deliverectOrderIdPendingWebhook: true },
    };
  }
  const failureMessage = result.success ? null : (result.error ?? "Unknown error");

  // Retry-safe: only set routingStatus to "failed" when currently "pending"; do not overwrite "sent" with "failed".
  const currentRouting = current?.routingStatus ?? "pending";
  const statusUpdate =
    result.success
      ? { routingStatus: "sent" as const, deliverectOrderId: result.externalOrderId ?? current?.deliverectOrderId ?? undefined }
      : currentRouting === "pending"
        ? { routingStatus: "failed" as const }
        : {};

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: {
      deliverectAttempts: vendorOrder.deliverectAttempts + 1,
      lastDeliverectPayload: payload as unknown as object,
      lastDeliverectResponse: responsePayload != null ? (responsePayload as Prisma.InputJsonValue) : Prisma.DbNull,
      deliverectSubmittedAt: now,
      deliverectLastError: failureMessage,
      ...statusUpdate,
    },
  });

  if (!result.success && currentRouting === "pending" && statusUpdate.routingStatus === "failed") {
    const { createVendorOrderIssue, getVendorOrderIssues } = await import("@/services/issues.service");
    const existing = await getVendorOrderIssues(vendorOrderId, "OPEN");
    if (!existing.some((i) => i.type === "routing_failure")) {
      await createVendorOrderIssue(vendorOrderId, "routing_failure", "HIGH", {
        notes: failureMessage ?? undefined,
        createdBy: "system",
      });
    }
  }

  if (result.success) {
    await prisma.vendorOrderStatusHistory.create({
      data: {
        vendorOrderId,
        routingStatus: "sent",
        source: "deliverect",
        rawPayload: (responsePayload ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const skipped = env.ROUTING_MODE === "mock";
  return {
    success: result.success,
    deliverectOrderId: result.externalOrderId ?? current?.deliverectOrderId ?? undefined,
    error: result.error,
    code: result.success ? undefined : skipped ? undefined : "SUBMISSION_FAILED",
    skipped,
  };
}
