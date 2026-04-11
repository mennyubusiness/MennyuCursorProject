/**
 * Unified order status: derive parent status from child vendor orders; update on webhook.
 * POS (Deliverect) is source of truth when available; fallback flow scaffolded.
 */
import { cache } from "react";
import {
  Prisma,
  VendorRoutingStatus,
  VendorFulfillmentStatus,
  type OrderStatus,
  type VendorOrderStatusAuthority,
  type VendorOrderStatusSource,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  deriveParentStatusFromChildren,
  parentStatusLabel,
  type ChildOrderState,
} from "@/domain/order-state";
import {
  getEffectiveChildStateForParentDerivation,
  isVendorReceiptConfirmed,
} from "@/lib/vendor-order-effective-state";
import type { ParentOrderStatus, VendorOrderFulfillmentStatus, VendorOrderRoutingStatus } from "@/domain/types";
import { shouldApplyStatusUpdate } from "@/domain/status-authority";
import { validateTransition, targetToUpdate, type VendorOrderTargetState } from "@/domain/vendor-order-transition";
import type {
  DeliverectWebhookApplyResult,
  DeliverectWebhookLastApplyRecord,
} from "@/domain/deliverect-webhook-apply";
import { interpretDeliverectWebhookFlat } from "@/integrations/deliverect/deliverect-status-map";
import {
  flattenDeliverectWebhookPayload,
  getDeliverectWebhookAuditStatusString,
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import {
  applyVendorOrderStatusWithMeta,
  legacySourceToStatusSource,
} from "@/services/vendor-order-status-instrumentation";
import { sendOrderStatusUpdate } from "./sms.service";
import { resolvePickupTimezone } from "@/lib/pickup-scheduling";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";
import { logDeliverectOrderWebhook } from "@/integrations/deliverect/deliverect-webhook-structured-log";

/** Source tag for dev simulator; SMS is skipped when source is this value. */
const DEV_SIMULATOR_SOURCE = "dev_simulator";

/**
 * Derive parent order status from vendor orders using effective child state (recovery-normalized).
 * Use this whenever persisting parent status so customer, admin, and vendor see the same state.
 */
export function deriveParentStatusFromVendorOrders(
  vendorOrders: Array<{
    routingStatus: string;
    fulfillmentStatus: string;
    statusHistory?: Array<{ source?: string | null }>;
  }>
): ParentOrderStatus {
  const children: ChildOrderState[] = vendorOrders.map((vo) =>
    getEffectiveChildStateForParentDerivation(vo, vo.statusHistory ?? null)
  );
  return deriveParentStatusFromChildren(children);
}

/**
 * Attach `derivedStatus`, `statusLabel`, and `resolvedPickupTimezone` using the same rules as
 * {@link getOrderWithUnifiedStatus}. Used by both the full order read and the slim customer poll snapshot.
 */
export function attachUnifiedStatusDerivedFields<
  T extends {
    status: OrderStatus;
    statusHistory: Array<{ status: string; createdAt: Date }>;
    pod: { pickupTimezone: string | null };
    vendorOrders: Array<{
      routingStatus: string;
      fulfillmentStatus: string;
      statusHistory?: Array<{ source?: string | null }> | null;
    }>;
  },
>(order: T): T & {
  derivedStatus: ParentOrderStatus;
  statusLabel: string;
  resolvedPickupTimezone: string;
} {
  const derivedFromChildren = deriveParentStatusFromChildren(
    order.vendorOrders.map((vo) =>
      getEffectiveChildStateForParentDerivation(vo, vo.statusHistory ?? null)
    )
  );
  const lastFromHistory =
    order.statusHistory.length > 0
      ? (order.statusHistory[order.statusHistory.length - 1].status as ParentOrderStatus)
      : null;
  const derived =
    lastFromHistory ??
    (order.status === "pending_payment" || order.status === "paid" ? order.status : derivedFromChildren) ??
    derivedFromChildren;
  return {
    ...order,
    derivedStatus: derived,
    statusLabel: parentStatusLabel(derived),
    resolvedPickupTimezone: resolvePickupTimezone(order.pod),
  };
}

export async function updateVendorOrderStatus(
  vendorOrderId: string,
  routingStatus?: string,
  fulfillmentStatus?: string,
  source: string = "deliverect",
  rawPayload?: unknown
): Promise<void> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { orderId: true, routingStatus: true, fulfillmentStatus: true },
  });
  if (!vo) return;

  const patch: {
    routingStatus?: VendorRoutingStatus;
    fulfillmentStatus?: VendorFulfillmentStatus;
  } = {};
  if (routingStatus) patch.routingStatus = routingStatus as VendorRoutingStatus;
  if (fulfillmentStatus) patch.fulfillmentStatus = fulfillmentStatus as VendorFulfillmentStatus;

  const prismaSource = legacySourceToStatusSource(source);
  const nextR = (routingStatus ?? vo.routingStatus) as string;
  const nextF = (fulfillmentStatus ?? vo.fulfillmentStatus) as string;

  await applyVendorOrderStatusWithMeta(
    {
      vendorOrderId,
      orderId: vo.orderId,
      patch,
      statusSource: prismaSource,
      historySource: source,
      rawPayload,
      extraVendorOrderUpdate: rawPayload
        ? { lastWebhookPayload: rawPayload as Prisma.InputJsonValue }
        : undefined,
      historyRoutingStatus: nextR,
      historyFulfillmentStatus: nextF,
    },
    source
  );
}

const FULFILLMENT_RANK: Record<VendorOrderFulfillmentStatus, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
  cancelled: 100,
};

/** Exported for tests — monotonic merge of mapped POS state onto current VendorOrder row. */
export function mergeDeliverectMappedIntoVendorOrder(
  vo: {
    routingStatus: VendorOrderRoutingStatus;
    fulfillmentStatus: VendorOrderFulfillmentStatus;
  },
  mapped: {
    routingStatus?: VendorOrderRoutingStatus;
    fulfillmentStatus?: VendorOrderFulfillmentStatus;
  }
): { nextRouting: VendorOrderRoutingStatus; nextFulfillment: VendorOrderFulfillmentStatus } {
  let nextRouting = vo.routingStatus;
  let nextFulfillment = vo.fulfillmentStatus;

  const posProgress =
    mapped.fulfillmentStatus &&
    ["accepted", "preparing", "ready", "completed"].includes(mapped.fulfillmentStatus);

  if (mapped.routingStatus === "failed") {
    if (vo.fulfillmentStatus !== "completed") {
      nextRouting = "failed";
      if (vo.fulfillmentStatus === "pending") nextFulfillment = "pending";
    }
  } else if (
    vo.routingStatus === "failed" &&
    vo.fulfillmentStatus === "pending" &&
    posProgress &&
    mapped.fulfillmentStatus
  ) {
    nextRouting = "confirmed";
    nextFulfillment = mapped.fulfillmentStatus;
  } else {
    if (mapped.routingStatus === "confirmed") {
      if (vo.routingStatus === "pending" || vo.routingStatus === "sent") {
        nextRouting = "confirmed";
      }
    }
    const inc = mapped.fulfillmentStatus;
    if (inc === "cancelled") {
      nextFulfillment = "cancelled";
      if (vo.routingStatus === "failed" || vo.routingStatus === "sent") {
        nextRouting = "confirmed";
      }
    } else if (inc && vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed") {
      if (FULFILLMENT_RANK[inc] > FULFILLMENT_RANK[nextFulfillment]) {
        nextFulfillment = inc;
      }
    }
  }

  return { nextRouting, nextFulfillment };
}

/** POS proposed strictly lower fulfillment rank than current (cancel/completed rules). */
function isStrictlyBackwardFulfillment(
  current: VendorOrderFulfillmentStatus,
  proposed: VendorFulfillmentStatus
): boolean {
  if (proposed === "cancelled") return false;
  // After cancel, any non-cancel webhook is treated as regression (re-opening).
  if (current === "cancelled") return true;
  if (current === "completed") return proposed !== "completed";
  return FULFILLMENT_RANK[proposed] < FULFILLMENT_RANK[current];
}

/** After any processed Deliverect webhook, promote to POS-managed when safe (never dma/admin_override). */
async function posAuthorityPromotionUpdateIfEligible(
  vendorOrderId: string
): Promise<Pick<Prisma.VendorOrderUpdateInput, "statusAuthority">> {
  const row = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { statusAuthority: true },
  });
  if (!row) return {};
  const a = row.statusAuthority;
  if (a === "admin_override" || a === "dma" || a === "pos") return {};
  if (a === null || a === "vendor_manual") {
    return { statusAuthority: "pos" };
  }
  return {};
}

async function persistDeliverectWebhookAuditOnly(
  vendorOrderId: string,
  orderId: string,
  rawPayload: unknown,
  externalAudit: string | null,
  apply: DeliverectWebhookLastApplyRecord,
  statusSource: VendorOrderStatusSource = "deliverect_webhook"
): Promise<void> {
  const payloadJson =
    rawPayload === undefined || rawPayload === null
      ? Prisma.DbNull
      : (rawPayload as Prisma.InputJsonValue);

  const authorityPromotion = await posAuthorityPromotionUpdateIfEligible(vendorOrderId);

  await prisma.vendorOrder.update({
    where: { id: vendorOrderId },
    data: {
      lastWebhookPayload: payloadJson,
      deliverectWebhookLastApply: apply as unknown as Prisma.InputJsonValue,
      lastStatusSource: statusSource,
      ...authorityPromotion,
      ...(externalAudit != null
        ? {
            lastExternalStatus: externalAudit,
            lastExternalStatusAt: new Date(),
            deliverectAutoRecheckAttemptedAt: null,
            deliverectAutoRecheckResult: null,
          }
        : {}),
    },
  });
  await recomputeAndPersistParentStatus(orderId, "deliverect");
}

type DeliverectInboundKind = "webhook" | "fallback";

/**
 * Shared inbound pipeline: webhook POST and reconciliation fallback use the same mapper + merge + applyVendorOrderStatusWithMeta.
 */
async function applyDeliverectInboundStatus(
  vendorOrderId: string,
  deliverectExternalId: string | null,
  rawPayload: unknown,
  inbound: DeliverectInboundKind
): Promise<DeliverectWebhookApplyResult> {
  const statusSource: VendorOrderStatusSource =
    inbound === "webhook" ? "deliverect_webhook" : "deliverect_fallback";
  const historySource = inbound === "webhook" ? "deliverect" : "deliverect_fallback";
  const applySource: DeliverectWebhookLastApplyRecord["applySource"] =
    inbound === "webhook" ? "webhook" : "fallback";

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      deliverectOrderId: true,
      lastExternalStatusAt: true,
      deliverectSubmittedAt: true,
      manuallyRecoveredAt: true,
      statusAuthority: true,
      deliverectAutoRecheckResult: true,
    },
  });
  if (!vo) throw new Error("Vendor order not found");

  const processedAt = new Date();

  const payloadObj =
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as DeliverectWebhookPayload)
      : ({} as DeliverectWebhookPayload);
  const flat = flattenDeliverectWebhookPayload(payloadObj);
  const interpretation = interpretDeliverectWebhookFlat(flat);
  const externalAudit =
    rawPayload && typeof rawPayload === "object"
      ? getDeliverectWebhookAuditStatusString(rawPayload as DeliverectWebhookPayload)
      : null;

  const nowIso = () => new Date().toISOString();

  if (interpretation.kind === "unmapped") {
    const apply: DeliverectWebhookLastApplyRecord = {
      outcome: "unmapped_status",
      applySource,
      processedAt: nowIso(),
      detail:
        inbound === "fallback"
          ? "Deliverect API lookup: payload did not map to a Mennyu status (strict allowlist)."
          : "Deliverect payload did not resolve to a mapped Mennyu status (strict allowlist). Raw codes/events are logged server-side.",
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      rawNumericCode: interpretation.rawNumericCode,
      rawEventHint: interpretation.rawEventHint,
      interpretedFulfillment: null,
      interpretedRouting: null,
      proposedFulfillment: vo.fulfillmentStatus,
      proposedRouting: vo.routingStatus,
    };
    await persistDeliverectWebhookAuditOnly(
      vendorOrderId,
      vo.orderId,
      rawPayload,
      externalAudit,
      apply,
      statusSource
    );
    logDeliverectOrderWebhook("unmapped_status_audit_only", {
      vendorOrderId,
      orderId: vo.orderId,
      inbound,
      rawNumericCode: interpretation.rawNumericCode,
    });
    return {
      outcome: "unmapped_status",
      orderId: vo.orderId,
      vendorOrderId,
      updatedVendorOrderState: false,
    };
  }

  const mapped = {
    routingStatus: interpretation.routingStatus,
    fulfillmentStatus: interpretation.fulfillmentStatus,
  };
  const { nextRouting, nextFulfillment } = mergeDeliverectMappedIntoVendorOrder(
    {
      routingStatus: vo.routingStatus as VendorOrderRoutingStatus,
      fulfillmentStatus: vo.fulfillmentStatus as VendorOrderFulfillmentStatus,
    },
    mapped
  );

  const backfillId =
    deliverectExternalId &&
    !vo.deliverectOrderId &&
    !String(deliverectExternalId).match(/^c[a-z0-9]{24}$/i)
      ? deliverectExternalId
      : null;

  const routingChanged = nextRouting !== vo.routingStatus;
  const fulfillmentChanged = nextFulfillment !== vo.fulfillmentStatus;
  const idBackfill = Boolean(backfillId);

  const interpretedFulfillment = interpretation.fulfillmentStatus;
  const interpretedRouting = interpretation.routingStatus ?? null;

  if (!routingChanged && !fulfillmentChanged && !idBackfill) {
    const backward = isStrictlyBackwardFulfillment(
      vo.fulfillmentStatus as VendorOrderFulfillmentStatus,
      interpretedFulfillment
    );
    const outcome: DeliverectWebhookLastApplyRecord["outcome"] = backward
      ? "ignored_backward"
      : "noop_same_status";
    const apply: DeliverectWebhookLastApplyRecord = {
      outcome,
      applySource,
      processedAt: nowIso(),
      detail: backward
        ? `Ignored POS fulfillment regression vs current ${vo.fulfillmentStatus} (webhook proposed ${interpretedFulfillment}).`
        : inbound === "fallback"
          ? "Deliverect API lookup: mapped status matches current Mennyu state (no row change)."
          : "Mapped status matches current Mennyu state after reconciliation.",
      currentFulfillment: vo.fulfillmentStatus,
      currentRouting: vo.routingStatus,
      rawNumericCode: interpretation.rawNumericCode,
      interpretedFulfillment,
      interpretedRouting,
      proposedFulfillment: nextFulfillment,
      proposedRouting: nextRouting,
    };
    await persistDeliverectWebhookAuditOnly(
      vendorOrderId,
      vo.orderId,
      rawPayload,
      externalAudit,
      apply,
      statusSource
    );
    logDeliverectOrderWebhook(
      backward ? "webhook_ignored_backward" : "webhook_noop_same_status",
      {
        vendorOrderId,
        orderId: vo.orderId,
        inbound,
        backward,
        currentFulfillment: vo.fulfillmentStatus,
        interpretedFulfillment,
      }
    );
    if (inbound === "webhook" && vo.manuallyRecoveredAt != null) {
      logDeliverectOrderWebhook("late_webhook_after_manual_recovery", {
        vendorOrderId,
        orderId: vo.orderId,
        outcome,
        manuallyRecoveredAt: vo.manuallyRecoveredAt.toISOString(),
      });
    }
    return {
      outcome,
      orderId: vo.orderId,
      vendorOrderId,
      updatedVendorOrderState: false,
    };
  }

  const firstExternalSignal = vo.lastExternalStatusAt == null;
  const minutesAfterDeliverectSubmit =
    firstExternalSignal && vo.deliverectSubmittedAt
      ? Math.max(
          0,
          Math.floor((processedAt.getTime() - vo.deliverectSubmittedAt.getTime()) / 60_000)
        )
      : null;
  const reconciledAfterStaleThreshold =
    minutesAfterDeliverectSubmit != null &&
    minutesAfterDeliverectSubmit >= DELIVERECT_RECONCILIATION_STALE_MINUTES;

  const priorFallbackEpisode =
    inbound === "webhook" && vo.deliverectAutoRecheckResult != null && String(vo.deliverectAutoRecheckResult).trim() !== "";

  const apply: DeliverectWebhookLastApplyRecord = {
    outcome: "applied",
    applySource,
    processedAt: nowIso(),
    detail:
      (inbound === "webhook" && vo.manuallyRecoveredAt != null
        ? "POS webhook after manual recovery episode (audit only — state still follows POS). "
        : "") +
      (priorFallbackEpisode
        ? "Webhook arrived after a prior automatic Deliverect recheck episode on this row. "
        : "") +
      (idBackfill
        ? inbound === "fallback"
          ? "Vendor order updated from Deliverect API lookup (includes deliverectOrderId backfill)."
          : "Vendor order updated from Deliverect (includes deliverectOrderId backfill)."
        : inbound === "fallback"
          ? "Vendor order updated from Deliverect API lookup (reconciliation fallback)."
          : "Vendor order updated from Deliverect."),
    currentFulfillment: vo.fulfillmentStatus,
    currentRouting: vo.routingStatus,
    rawNumericCode: interpretation.rawNumericCode,
    interpretedFulfillment,
    interpretedRouting,
    proposedFulfillment: nextFulfillment,
    proposedRouting: nextRouting,
    ...(firstExternalSignal
      ? {
          firstExternalSignal: true,
          minutesAfterDeliverectSubmit,
          reconciledAfterStaleThreshold,
        }
      : {}),
  };

  const patch: {
    routingStatus?: VendorRoutingStatus;
    fulfillmentStatus?: VendorFulfillmentStatus;
  } = {};
  if (routingChanged) patch.routingStatus = nextRouting;
  if (fulfillmentChanged) patch.fulfillmentStatus = nextFulfillment;

  const authorityPromotion = await posAuthorityPromotionUpdateIfEligible(vendorOrderId);

  await applyVendorOrderStatusWithMeta(
    {
      vendorOrderId,
      orderId: vo.orderId,
      patch,
      statusSource,
      historySource,
      ...(externalAudit != null ? { externalStatus: externalAudit } : {}),
      rawPayload,
      extraVendorOrderUpdate: {
        ...(idBackfill ? { deliverectOrderId: backfillId } : {}),
        lastWebhookPayload:
          rawPayload === undefined || rawPayload === null
            ? Prisma.DbNull
            : (rawPayload as Prisma.InputJsonValue),
        deliverectWebhookLastApply: apply as unknown as Prisma.InputJsonValue,
        ...authorityPromotion,
      },
      historyRoutingStatus: nextRouting,
      historyFulfillmentStatus: nextFulfillment,
    },
    historySource
  );

  logDeliverectOrderWebhook("webhook_applied", {
    vendorOrderId,
    orderId: vo.orderId,
    inbound,
    firstExternalSignal,
    deliverectOrderIdBackfill: Boolean(idBackfill),
    routingChanged,
    fulfillmentChanged,
    minutesAfterDeliverectSubmit,
    reconciledAfterStaleThreshold,
  });

  if (reconciledAfterStaleThreshold && inbound === "webhook") {
    logDeliverectOrderWebhook("late_webhook_after_overdue", {
      vendorOrderId,
      orderId: vo.orderId,
      minutesAfterDeliverectSubmit,
      thresholdMinutes: DELIVERECT_RECONCILIATION_STALE_MINUTES,
    });
  }
  if (reconciledAfterStaleThreshold && inbound === "fallback") {
    logDeliverectOrderWebhook("late_webhook_after_overdue", {
      vendorOrderId,
      orderId: vo.orderId,
      minutesAfterDeliverectSubmit,
      thresholdMinutes: DELIVERECT_RECONCILIATION_STALE_MINUTES,
      inbound: "fallback",
    });
  }
  if (inbound === "webhook" && vo.manuallyRecoveredAt != null) {
    logDeliverectOrderWebhook("late_webhook_after_manual_recovery", {
      vendorOrderId,
      orderId: vo.orderId,
      manuallyRecoveredAt: vo.manuallyRecoveredAt.toISOString(),
      statusAuthority: vo.statusAuthority,
    });
  }
  if (priorFallbackEpisode) {
    logDeliverectOrderWebhook("late_webhook_after_fallback_episode", {
      vendorOrderId,
      orderId: vo.orderId,
      priorAutoRecheckResult: vo.deliverectAutoRecheckResult,
    });
  }

  return {
    outcome: "applied",
    orderId: vo.orderId,
    vendorOrderId,
    updatedVendorOrderState: true,
  };
}

/**
 * Apply Deliverect status webhook: strict mapper, monotonic reconciliation, explicit outcomes,
 * and VendorOrder.deliverectWebhookLastApply audit JSON.
 */
export async function applyDeliverectStatusWebhook(
  vendorOrderId: string,
  deliverectExternalId: string | null,
  rawPayload: unknown
): Promise<DeliverectWebhookApplyResult> {
  return applyDeliverectInboundStatus(vendorOrderId, deliverectExternalId, rawPayload, "webhook");
}

/**
 * Same pipeline as webhook, with source `deliverect_fallback` (admin/API reconciliation lookup).
 */
export async function applyDeliverectStatusFromFallbackLookup(
  vendorOrderId: string,
  deliverectExternalId: string | null,
  rawPayload: unknown
): Promise<DeliverectWebhookApplyResult> {
  return applyDeliverectInboundStatus(vendorOrderId, deliverectExternalId, rawPayload, "fallback");
}

export interface ApplyVendorOrderTransitionResult {
  success: true;
  vendorOrderId: string;
  orderId: string;
  routingStatus: VendorOrderRoutingStatus;
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  parentStatus: ParentOrderStatus;
}

export interface ApplyVendorOrderTransitionError {
  success: false;
  error: string;
  code?: string;
  /** Set when blocked by status authority (vendor dashboard vs POS). */
  precedenceReason?: "POS_MANAGED_USE_FALLBACK" | "UNKNOWN";
}

/** Options for transitions that need extra VO fields or richer history (e.g. admin manual recovery). */
export type ApplyVendorOrderTransitionOpts = {
  extraVendorOrderUpdate?: Prisma.VendorOrderUpdateInput;
  /** Replaces default history rawPayload `{ targetState }` when provided. */
  historyRawPayload?: unknown;
  historyAuthority?: VendorOrderStatusAuthority;
};

const VENDOR_DASHBOARD_POS_BLOCK_MESSAGE =
  "This order is managed by the POS. Updates should come from the kitchen system. If the POS is wrong, ask an admin to use manual recovery to take control.";

/**
 * Apply a single state transition for a vendor order (shared by dev simulator and vendor dashboard).
 * Validates transition, updates VendorOrder, appends history, recomputes parent order status.
 * When source !== "dev_simulator", customer SMS is sent on parent status change.
 */
export async function applyVendorOrderTransition(
  vendorOrderId: string,
  targetState: VendorOrderTargetState,
  source: string,
  opts?: ApplyVendorOrderTransitionOpts
): Promise<ApplyVendorOrderTransitionResult | ApplyVendorOrderTransitionError> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      statusAuthority: true,
      lastStatusSource: true,
      deliverectChannelLinkId: true,
      statusHistory: { select: { source: true } },
      vendor: { select: { deliverectChannelLinkId: true } },
    },
  });
  if (!vo) {
    return { success: false, error: "Vendor order not found", code: "NOT_FOUND" };
  }

  if (legacySourceToStatusSource(source) === "vendor_dashboard") {
    const prec = shouldApplyStatusUpdate(
      {
        statusAuthority: vo.statusAuthority,
        lastStatusSource: vo.lastStatusSource,
        deliverectChannelLinkId: vo.deliverectChannelLinkId,
        vendor: vo.vendor,
        routingStatus: vo.routingStatus,
        manuallyRecoveredAt: vo.manuallyRecoveredAt,
      },
      "vendor_dashboard"
    );
    if (!prec.allowed) {
      return {
        success: false,
        error: VENDOR_DASHBOARD_POS_BLOCK_MESSAGE,
        code: prec.reason,
        precedenceReason: prec.reason,
      };
    }
  }

  const receiptConfirmed = isVendorReceiptConfirmed(vo, vo.statusHistory);
  const err = validateTransition(
    vo.routingStatus as VendorOrderRoutingStatus,
    vo.fulfillmentStatus as VendorOrderFulfillmentStatus,
    targetState,
    source,
    receiptConfirmed
  );
  if (err) {
    return { success: false, error: err, code: "INVALID_TRANSITION" };
  }

  const update = targetToUpdate(targetState);
  if (Object.keys(update).length === 0) {
    return { success: false, error: "No update for target state", code: "INVALID_STATE" };
  }

  const nextRouting = (update.routingStatus ?? vo.routingStatus) as VendorRoutingStatus;
  const nextFulfillment = (update.fulfillmentStatus ?? vo.fulfillmentStatus) as VendorFulfillmentStatus;

  const patch: {
    routingStatus?: VendorRoutingStatus;
    fulfillmentStatus?: VendorFulfillmentStatus;
  } = {};
  if (update.routingStatus !== undefined) patch.routingStatus = update.routingStatus;
  if (update.fulfillmentStatus !== undefined) patch.fulfillmentStatus = update.fulfillmentStatus;

  const prismaSource = legacySourceToStatusSource(source);

  const parentStatus = await applyVendorOrderStatusWithMeta(
    {
      vendorOrderId,
      orderId: vo.orderId,
      patch,
      statusSource: prismaSource,
      historySource: source,
      rawPayload: opts?.historyRawPayload ?? { targetState },
      historyRoutingStatus: nextRouting,
      historyFulfillmentStatus: nextFulfillment,
      extraVendorOrderUpdate: opts?.extraVendorOrderUpdate,
      historyAuthority: opts?.historyAuthority,
    },
    source
  );

  return {
    success: true,
    vendorOrderId,
    orderId: vo.orderId,
    routingStatus: nextRouting,
    fulfillmentStatus: nextFulfillment,
    parentStatus,
  };
}

export async function recomputeAndPersistParentStatus(
  orderId: string,
  source: string = "system"
): Promise<ParentOrderStatus> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: { include: { statusHistory: { select: { source: true } } } },
    },
  });
  if (!order) return "failed";

  // Use effective child state so manually recovered VOs count as active (parent no longer "failed").
  const children: ChildOrderState[] = order.vendorOrders.map((vo) =>
    getEffectiveChildStateForParentDerivation(vo, vo.statusHistory)
  );
  const newStatus = deriveParentStatusFromChildren(children);

  if (newStatus !== order.status) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId, status: newStatus, source },
    });
    if (newStatus === "partially_completed") {
      const { createOrderIssue, getOrderIssues } = await import("@/services/issues.service");
      const existing = await getOrderIssues(orderId, "OPEN");
      const hasPartial = existing.some((i) => i.type === "partial_order");
      if (!hasPartial) {
        await createOrderIssue(orderId, "partial_order", "LOW", {
          notes: "Order has mix of completed and incomplete vendor orders",
          createdBy: "system",
        });
      }
    }
    if (source !== DEV_SIMULATOR_SOURCE) {
      await sendOrderStatusUpdate(order.customerPhone, orderId, parentStatusLabel(newStatus));
    }
  }
  return newStatus;
}

/**
 * Fallback: when POS confirmation is delayed or fails, preserve order and expose fallback.
 * Future: manual/SMS confirmation or dashboard action.
 * Cached per request to avoid duplicate fetches when React Strict Mode double-renders in dev.
 */
async function getOrderWithUnifiedStatusImpl(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: {
        include: {
          vendor: true,
          lineItems: {
            include: {
              selections: { orderBy: { id: "asc" } },
            },
          },
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
      pod: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      refundAttempts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return null;
  return attachUnifiedStatusDerivedFields(order);
}

/**
 * Customer status polling: same derived fields as the full order read, but without line items /
 * modifier selections (large nested trees). Merge client-side with the initial full order to keep
 * line-item UI stable.
 */
export async function getCustomerOrderStatusPollSnapshot(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: {
        include: {
          vendor: { select: { id: true, name: true } },
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
      pod: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      refundAttempts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) return null;
  return attachUnifiedStatusDerivedFields(order);
}

export const getOrderWithUnifiedStatus = cache(getOrderWithUnifiedStatusImpl);

/**
 * Same payload as {@link getOrderWithUnifiedStatus}, but not wrapped in React `cache()`.
 * Use for client polling so every request reads current DB state.
 */
export function getOrderWithUnifiedStatusLive(orderId: string) {
  return getOrderWithUnifiedStatusImpl(orderId);
}
