/**
 * Deliverect submission boundary: load → validate (live only) → transform → submit (when gated) → persist audit.
 * Live submission is gated by ROUTING_MODE=deliverect; mock mode only audits payload.
 * One VendorOrder at a time; retry-safe status transitions; full request/response audit.
 */
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { submitOrder } from "@/integrations/deliverect/client";
import { getVendorOrderForDeliverect } from "@/integrations/deliverect/load";
import { mennyuVendorOrderToDeliverectPayload } from "@/integrations/deliverect/transform";
import { validateForSubmission } from "@/integrations/deliverect/validate";

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

  // Validate required Deliverect identifiers before building payload (live mode only).
  // Mock mode skips validation so devs can build and audit payloads with placeholder IDs.
  if (env.ROUTING_MODE === "deliverect") {
    const validation = validateForSubmission(vendorOrder, channelLinkId);
    if (!validation.valid) {
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
  let result: { success: boolean; externalOrderId?: string; error?: string; raw?: unknown };

  if (env.ROUTING_MODE === "mock") {
    result = {
      success: false,
      error: "ROUTING_MODE=mock: live submission disabled",
      raw: { _mock: true, message: "Submission skipped; payload built and audited only." },
    };
  } else {
    result = await submitOrder(payload);
  }

  const responsePayload = result.raw != null ? (result.raw as object) : null;
  const failureMessage = result.success ? null : (result.error ?? "Unknown error");

  // Retry-safe: only set routingStatus to "failed" when currently "pending"; do not overwrite "sent" with "failed".
  const current = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { routingStatus: true, deliverectOrderId: true },
  });
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
      lastDeliverectResponse: responsePayload,
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
        rawPayload: responsePayload ?? {},
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
