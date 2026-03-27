/**
 * Unified order status: derive parent status from child vendor orders; update on webhook.
 * POS (Deliverect) is source of truth when available; fallback flow scaffolded.
 */
import { cache } from "react";
import {
  Prisma,
  VendorRoutingStatus,
  VendorFulfillmentStatus,
  type VendorOrderStatusAuthority,
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

function mergeDeliverectMappedIntoVendorOrder(
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
  apply: DeliverectWebhookLastApplyRecord
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
      lastStatusSource: "deliverect_webhook",
      ...authorityPromotion,
      ...(externalAudit != null
        ? { lastExternalStatus: externalAudit, lastExternalStatusAt: new Date() }
        : {}),
    },
  });
  await recomputeAndPersistParentStatus(orderId, "deliverect");
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
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      deliverectOrderId: true,
    },
  });
  if (!vo) throw new Error("Vendor order not found");

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
      processedAt: nowIso(),
      detail:
        "Deliverect payload did not resolve to a mapped Mennyu status (strict allowlist). Raw codes/events are logged server-side.",
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
      apply
    );
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
      processedAt: nowIso(),
      detail: backward
        ? `Ignored POS fulfillment regression vs current ${vo.fulfillmentStatus} (webhook proposed ${interpretedFulfillment}).`
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
      apply
    );
    return {
      outcome,
      orderId: vo.orderId,
      vendorOrderId,
      updatedVendorOrderState: false,
    };
  }

  const apply: DeliverectWebhookLastApplyRecord = {
    outcome: "applied",
    processedAt: nowIso(),
    detail: idBackfill
      ? "Vendor order updated from Deliverect (includes deliverectOrderId backfill)."
      : "Vendor order updated from Deliverect.",
    currentFulfillment: vo.fulfillmentStatus,
    currentRouting: vo.routingStatus,
    rawNumericCode: interpretation.rawNumericCode,
    interpretedFulfillment,
    interpretedRouting,
    proposedFulfillment: nextFulfillment,
    proposedRouting: nextRouting,
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
      statusSource: "deliverect_webhook",
      historySource: "deliverect",
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
    "deliverect"
  );

  return {
    outcome: "applied",
    orderId: vo.orderId,
    vendorOrderId,
    updatedVendorOrderState: true,
  };
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
  const derivedFromChildren = deriveParentStatusFromChildren(
    order.vendorOrders.map((vo) =>
      getEffectiveChildStateForParentDerivation(vo, vo.statusHistory)
    )
  );
  // Current status = latest we recorded (last in statusHistory). Derivation from children never
  // returns pending_payment/paid; when those are the latest, use parent order.status.
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

export const getOrderWithUnifiedStatus = cache(getOrderWithUnifiedStatusImpl);

/**
 * Same payload as {@link getOrderWithUnifiedStatus}, but not wrapped in React `cache()`.
 * Use for client polling so every request reads current DB state.
 */
export function getOrderWithUnifiedStatusLive(orderId: string) {
  return getOrderWithUnifiedStatusImpl(orderId);
}
