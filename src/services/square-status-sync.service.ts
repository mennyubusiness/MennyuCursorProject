import "server-only";

import { Prisma } from "@prisma/client";
import type { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { fetchSquareOrder } from "@/lib/integrations/square/square-api.client";
import {
  ensureSquareAccessToken,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";
import type {
  SquareOrderSnapshot,
  SquareOrderSubmitAudit,
  SquareWebhookLastApplyRecord,
} from "@/lib/integrations/square/square-order.types";
import {
  mapSquareOrderSnapshotToVendorStatus,
  mergeSquareMappedIntoVendorOrder,
} from "@/lib/integrations/square/square-status-mapper";
import { isSquareWebhookSignatureConfigured } from "@/lib/integrations/square/square-webhook-verify";
import { applyVendorOrderStatusWithMeta } from "@/services/vendor-order-status-instrumentation";

export type SquareStatusSyncApplySource = "webhook" | "admin_manual";

export type SquareStatusSyncResult = {
  outcome: SquareWebhookLastApplyRecord["outcome"];
  orderId: string;
  vendorOrderId: string;
  updatedVendorOrderState: boolean;
  detail?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function isSquareStatusSyncConfigured(): boolean {
  return isSquareWebhookSignatureConfigured();
}

async function persistSquareStatusSyncAudit(
  vendorOrderId: string,
  orderId: string,
  apply: SquareWebhookLastApplyRecord,
  input: {
    webhookPayload?: unknown;
    squareOrder?: SquareOrderSnapshot | null;
  }
): Promise<void> {
  const existing = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { lastSquarePayload: true },
  });
  const prior =
    existing?.lastSquarePayload != null && typeof existing.lastSquarePayload === "object"
      ? (existing.lastSquarePayload as SquareOrderSubmitAudit)
      : {};

  const nextAudit: SquareOrderSubmitAudit = {
    ...prior,
    squareOrderState: apply.squareOrderState ?? prior.squareOrderState,
    statusSync: apply,
    ...(input.squareOrder
      ? {
          squareOrderState: input.squareOrder.state ?? prior.squareOrderState,
        }
      : {}),
  };

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: {
      lastSquarePayload: nextAudit as unknown as Prisma.InputJsonValue,
      ...(input.webhookPayload != null
        ? { lastWebhookPayload: input.webhookPayload as Prisma.InputJsonValue }
        : {}),
      lastStatusSource: "square_webhook",
      ...(apply.externalAudit || apply.squareFulfillmentState || apply.squareOrderState
        ? {
            lastExternalStatus:
              apply.externalAudit ??
              [
                apply.squareOrderState ? `order:${apply.squareOrderState}` : null,
                apply.squareFulfillmentState ? `fulfillment:${apply.squareFulfillmentState}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            lastExternalStatusAt: new Date(),
          }
        : {}),
    },
  });

  await recomputeParentAfterSquareSync(orderId);
}

async function recomputeParentAfterSquareSync(orderId: string): Promise<void> {
  const { recomputeAndPersistParentStatus } = await import("@/services/order-status.service");
  await recomputeAndPersistParentStatus(orderId, "square_webhook");
}

function buildApplyRecord(
  base: Omit<SquareWebhookLastApplyRecord, "processedAt"> & { processedAt?: string }
): SquareWebhookLastApplyRecord {
  return {
    ...base,
    processedAt: base.processedAt ?? nowIso(),
  };
}

export function validateSquareOrderForVendor(input: {
  order: SquareOrderSnapshot;
  expectedSquareOrderId: string;
  expectedLocationId: string | null;
  expectedMerchantId: string | null;
}): string | null {
  if (input.order.id?.trim() !== input.expectedSquareOrderId.trim()) {
    return "Square order id mismatch";
  }
  if (
    input.expectedLocationId?.trim() &&
    input.order.location_id?.trim() &&
    input.order.location_id.trim() !== input.expectedLocationId.trim()
  ) {
    return "Square order location does not match vendor connection";
  }
  if (
    input.expectedMerchantId?.trim() &&
    input.order.reference_id &&
    input.order.reference_id !== input.expectedSquareOrderId
  ) {
    // reference_id is OO vendor order id on injection — not a merchant check.
  }
  return null;
}

export async function applySquareOrderStatusSync(input: {
  vendorOrderId: string;
  squareOrderId?: string | null;
  applySource: SquareStatusSyncApplySource;
  webhookPayload?: unknown;
  webhookEventId?: string | null;
  merchantId?: string | null;
  locationId?: string | null;
}): Promise<SquareStatusSyncResult> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: input.vendorOrderId },
    select: {
      id: true,
      orderId: true,
      vendorId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      squareOrderId: true,
      lastSquarePayload: true,
    },
  });
  if (!vo) throw new Error("Vendor order not found");

  const squareOrderId = (input.squareOrderId ?? vo.squareOrderId)?.trim();
  if (!squareOrderId) {
    return {
      outcome: "validation_failed",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: "No squareOrderId on vendor order",
    };
  }

  const connection = await getActiveSquareConnectionForVendor(vo.vendorId);
  if (!connection) {
    const apply = buildApplyRecord({
      outcome: "fetch_failed",
      applySource: input.applySource,
      detail: "Square connection not found for vendor",
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
    });
    return {
      outcome: "fetch_failed",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: apply.detail,
    };
  }

  let squareOrder: SquareOrderSnapshot | null = null;
  try {
    const token = await ensureSquareAccessToken(connection);
    if (!token) {
      throw new Error("Square access token unavailable");
    }
    const response = await fetchSquareOrder(token, squareOrderId);
    squareOrder = response.order ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const apply = buildApplyRecord({
      outcome: "fetch_failed",
      applySource: input.applySource,
      detail: message,
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      lastError: message,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
    });
    return {
      outcome: "fetch_failed",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: message,
    };
  }

  if (!squareOrder) {
    const apply = buildApplyRecord({
      outcome: "fetch_failed",
      applySource: input.applySource,
      detail: "Square order not found in API response",
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
    });
    return {
      outcome: "fetch_failed",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: apply.detail,
    };
  }

  const validationError = validateSquareOrderForVendor({
    order: squareOrder,
    expectedSquareOrderId: squareOrderId,
    expectedLocationId: input.locationId ?? connection.externalLocationId,
    expectedMerchantId: input.merchantId ?? connection.externalMerchantId,
  });
  if (validationError) {
    const apply = buildApplyRecord({
      outcome: "validation_failed",
      applySource: input.applySource,
      detail: validationError,
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      squareOrderState: squareOrder.state ?? null,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
      squareOrder,
    });
    return {
      outcome: "validation_failed",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: validationError,
    };
  }

  const mapped = mapSquareOrderSnapshotToVendorStatus(squareOrder);
  if (!mapped) {
    const apply = buildApplyRecord({
      outcome: "unmapped_status",
      applySource: input.applySource,
      detail: "Square order state did not map to an Open Order fulfillment status",
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      squareOrderState: squareOrder.state ?? null,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
      squareOrder,
    });
    return {
      outcome: "unmapped_status",
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: apply.detail,
    };
  }

  const { nextRouting, nextFulfillment } = mergeSquareMappedIntoVendorOrder(
    {
      routingStatus: vo.routingStatus as VendorRoutingStatus,
      fulfillmentStatus: vo.fulfillmentStatus as VendorFulfillmentStatus,
    },
    {
      routingStatus: mapped.routingStatus,
      fulfillmentStatus: mapped.fulfillmentStatus,
    }
  );

  const routingChanged = nextRouting !== vo.routingStatus;
  const fulfillmentChanged = nextFulfillment !== vo.fulfillmentStatus;

  if (!routingChanged && !fulfillmentChanged) {
    const backward =
      mapped.fulfillmentStatus &&
      ["pending", "accepted", "preparing", "ready"].includes(vo.fulfillmentStatus) &&
      ["pending", "accepted", "preparing", "ready"].includes(mapped.fulfillmentStatus) &&
      mapped.fulfillmentStatus !== vo.fulfillmentStatus;
    const outcome: SquareWebhookLastApplyRecord["outcome"] = backward
      ? "ignored_backward"
      : "noop_same_status";
    const apply = buildApplyRecord({
      outcome,
      applySource: input.applySource,
      detail:
        outcome === "ignored_backward"
          ? `Ignored Square fulfillment regression (${mapped.fulfillmentStatus} vs current ${vo.fulfillmentStatus}).`
          : "Square mapped status matches current Open Order state.",
      squareOrderId,
      webhookEventId: input.webhookEventId ?? null,
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      interpretedFulfillment: mapped.fulfillmentStatus,
      interpretedRouting: mapped.routingStatus ?? null,
      proposedFulfillment: nextFulfillment,
      proposedRouting: nextRouting,
      squareOrderState: mapped.squareOrderState,
      squareFulfillmentState: mapped.squareFulfillmentState,
      externalAudit: mapped.externalAudit,
    });
    await persistSquareStatusSyncAudit(vo.id, vo.orderId, apply, {
      webhookPayload: input.webhookPayload,
      squareOrder,
    });
    await prisma.vendorIntegrationConnection.update({
      where: { id: connection.id },
      data: { lastWebhookAt: new Date() },
    });
    return {
      outcome,
      orderId: vo.orderId,
      vendorOrderId: vo.id,
      updatedVendorOrderState: false,
      detail: apply.detail,
    };
  }

  const apply = buildApplyRecord({
    outcome: "applied",
    applySource: input.applySource,
    detail: `Applied Square status ${mapped.externalAudit}`,
    squareOrderId,
    webhookEventId: input.webhookEventId ?? null,
    currentFulfillment: vo.fulfillmentStatus,
    currentRouting: vo.routingStatus,
    interpretedFulfillment: mapped.fulfillmentStatus,
    interpretedRouting: mapped.routingStatus ?? null,
    proposedFulfillment: nextFulfillment,
    proposedRouting: nextRouting,
    squareOrderState: mapped.squareOrderState,
    squareFulfillmentState: mapped.squareFulfillmentState,
    externalAudit: mapped.externalAudit,
  });

  await applyVendorOrderStatusWithMeta(
    {
      vendorOrderId: vo.id,
      orderId: vo.orderId,
      patch: {
        ...(routingChanged ? { routingStatus: nextRouting } : {}),
        ...(fulfillmentChanged ? { fulfillmentStatus: nextFulfillment } : {}),
      },
      statusSource: "square_webhook",
      historySource: "square",
      externalStatus: mapped.externalAudit,
      rawPayload: input.webhookPayload ?? squareOrder,
      extraVendorOrderUpdate: {
        lastSquarePayload: {
          ...(typeof vo.lastSquarePayload === "object" && vo.lastSquarePayload
            ? (vo.lastSquarePayload as SquareOrderSubmitAudit)
            : {}),
          squareOrderState: mapped.squareOrderState ?? undefined,
          statusSync: apply,
        } as unknown as Prisma.InputJsonValue,
        ...(input.webhookPayload != null
          ? { lastWebhookPayload: input.webhookPayload as Prisma.InputJsonValue }
          : {}),
        statusAuthority: "pos",
      },
      historyRoutingStatus: nextRouting,
      historyFulfillmentStatus: nextFulfillment,
      historyAuthority: "pos",
    },
    "square_webhook"
  );

  await prisma.vendorIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastWebhookAt: new Date() },
  });

  return {
    outcome: "applied",
    orderId: vo.orderId,
    vendorOrderId: vo.id,
    updatedVendorOrderState: true,
    detail: apply.detail,
  };
}

export async function findVendorOrderIdBySquareOrderId(
  squareOrderId: string
): Promise<{ vendorOrderId: string; vendorId: string; orderId: string } | null> {
  const row = await prisma.vendorOrder.findFirst({
    where: { squareOrderId: squareOrderId.trim() },
    select: { id: true, vendorId: true, orderId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return { vendorOrderId: row.id, vendorId: row.vendorId, orderId: row.orderId };
}

export async function syncSquareOrderStatusBySquareOrderId(input: {
  squareOrderId: string;
  applySource: SquareStatusSyncApplySource;
  webhookPayload?: unknown;
  webhookEventId?: string | null;
  merchantId?: string | null;
  locationId?: string | null;
}): Promise<
  | { matched: false; outcome: "ignored_no_match" }
  | ({ matched: true } & SquareStatusSyncResult)
> {
  const match = await findVendorOrderIdBySquareOrderId(input.squareOrderId);
  if (!match) {
    return { matched: false, outcome: "ignored_no_match" };
  }

  const result = await applySquareOrderStatusSync({
    vendorOrderId: match.vendorOrderId,
    squareOrderId: input.squareOrderId,
    applySource: input.applySource,
    webhookPayload: input.webhookPayload,
    webhookEventId: input.webhookEventId,
    merchantId: input.merchantId,
    locationId: input.locationId,
  });

  return { matched: true, ...result };
}
