/**
 * Reconciliation fallback: GET Deliverect order by external id when webhooks are missing.
 * Uses the same apply pipeline as webhooks ({@link applyDeliverectStatusFromFallbackLookup}).
 */
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { extractDeliverectOrderId, fetchDeliverectOrderById } from "@/integrations/deliverect/client";
import { matchDeliverectGetOrderResponseToVendorOrder } from "@/integrations/deliverect/deliverect-order-lookup-match";
import {
  isAwaitingDeliverectReconciliation,
  isDeliverectReconciliationOverdue,
  reconciliationClockStart,
} from "@/lib/deliverect-reconciliation-helpers";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";
import { shouldApplyStatusUpdate } from "@/domain/status-authority";
import { applyDeliverectStatusFromFallbackLookup } from "@/services/order-status.service";

const LOG = "[Deliverect]";

export type DeliverectFallbackResult =
  | {
      outcome: "applied";
      deliverectWebhookApplyOutcome: string;
      updatedVendorOrderState: boolean;
      lookupDeliverectOrderId: string;
    }
  | { outcome: "no_match"; reason: string; lookupDeliverectOrderId?: string }
  | { outcome: "ambiguous"; reason: string }
  | { outcome: "not_eligible"; reason: string }
  | { outcome: "noop"; deliverectWebhookApplyOutcome: string };

export type DeliverectFallbackTrigger = "manual" | "automatic";

export type DeliverectFallbackOptions = {
  /** If true, only run when past reconciliation stale threshold. */
  onlyIfOverdue?: boolean;
  /** If false (default), skip when manually recovered (admin_override path). */
  allowAfterManualRecovery?: boolean;
  /** Distinguishes admin UI/cron automation in logs (default manual). */
  trigger?: DeliverectFallbackTrigger;
};

function resolveLookupDeliverectOrderId(vo: {
  deliverectOrderId: string | null;
  lastDeliverectResponse: unknown;
}): string | null {
  if (vo.deliverectOrderId?.trim()) return vo.deliverectOrderId.trim();
  if (vo.lastDeliverectResponse == null || typeof vo.lastDeliverectResponse !== "object") return null;
  const body = (vo.lastDeliverectResponse as { body?: unknown }).body;
  return extractDeliverectOrderId(body ?? vo.lastDeliverectResponse) ?? null;
}

export async function attemptDeliverectReconciliationFallback(
  vendorOrderId: string,
  options?: DeliverectFallbackOptions
): Promise<DeliverectFallbackResult> {
  const onlyIfOverdue = options?.onlyIfOverdue ?? false;
  const allowAfterManualRecovery = options?.allowAfterManualRecovery ?? false;
  const trigger: DeliverectFallbackTrigger = options?.trigger ?? "manual";
  const now = new Date();

  console.info(
    `${LOG} fallback_attempt_started trigger=${trigger} vendorOrderId=${vendorOrderId} onlyIfOverdue=${onlyIfOverdue} allowAfterManualRecovery=${allowAfterManualRecovery}`
  );

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      lastExternalStatusAt: true,
      deliverectSubmittedAt: true,
      deliverectOrderId: true,
      lastDeliverectResponse: true,
      deliverectChannelLinkId: true,
      manuallyRecoveredAt: true,
      statusAuthority: true,
      lastStatusSource: true,
      createdAt: true,
      vendor: { select: { deliverectChannelLinkId: true } },
    },
  });

  if (!vo) {
    console.warn(`${LOG} fallback_rejected reason=not_found vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "vendor_order_not_found" };
  }

  const channelLinkId = vo.deliverectChannelLinkId ?? vo.vendor.deliverectChannelLinkId;
  if (channelLinkId == null || String(channelLinkId).trim() === "") {
    console.warn(`${LOG} fallback_rejected reason=no_deliverect_channel vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "no_deliverect_channel" };
  }

  if (env.ROUTING_MODE !== "deliverect") {
    console.warn(`${LOG} fallback_rejected reason=routing_mode_mock vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "routing_mode_not_deliverect" };
  }

  if (vo.lastExternalStatusAt != null) {
    console.warn(`${LOG} fallback_rejected reason=already_reconciled vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "already_reconciled" };
  }

  if (vo.routingStatus !== "sent") {
    console.warn(
      `${LOG} fallback_rejected reason=routing_not_sent vendorOrderId=${vendorOrderId} routingStatus=${vo.routingStatus}`
    );
    return { outcome: "not_eligible", reason: "routing_not_sent" };
  }

  if (vo.fulfillmentStatus !== "pending") {
    console.warn(
      `${LOG} fallback_rejected reason=fulfillment_not_pending vendorOrderId=${vendorOrderId} fulfillment=${vo.fulfillmentStatus}`
    );
    return { outcome: "not_eligible", reason: "fulfillment_not_pending" };
  }

  if (vo.manuallyRecoveredAt != null && !allowAfterManualRecovery) {
    console.warn(`${LOG} fallback_rejected reason=manual_recovery vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "manual_recovery_without_force" };
  }

  const snap = {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    lastExternalStatusAt: vo.lastExternalStatusAt,
    deliverectSubmittedAt: vo.deliverectSubmittedAt,
    createdAt: vo.createdAt,
  } as const;
  if (!isAwaitingDeliverectReconciliation(snap)) {
    console.warn(`${LOG} fallback_rejected reason=not_awaiting_reconciliation vendorOrderId=${vendorOrderId}`);
    return { outcome: "not_eligible", reason: "not_awaiting_reconciliation" };
  }

  if (onlyIfOverdue) {
    if (
      !isDeliverectReconciliationOverdue(snap, DELIVERECT_RECONCILIATION_STALE_MINUTES, now)
    ) {
      const start = reconciliationClockStart(snap);
      console.warn(
        `${LOG} fallback_rejected reason=not_overdue vendorOrderId=${vendorOrderId} clockStart=${start?.toISOString() ?? "null"}`
      );
      return { outcome: "not_eligible", reason: "not_overdue_yet" };
    }
  }

  const prec = shouldApplyStatusUpdate(
    {
      statusAuthority: vo.statusAuthority,
      lastStatusSource: vo.lastStatusSource,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendor: vo.vendor,
      routingStatus: vo.routingStatus,
      manuallyRecoveredAt: vo.manuallyRecoveredAt,
    },
    "deliverect_fallback"
  );
  if (!prec.allowed) {
    console.warn(
      `${LOG} fallback_rejected reason=precedence_blocked vendorOrderId=${vendorOrderId} precedence=${prec.reason ?? "unknown"}`
    );
    return { outcome: "not_eligible", reason: "precedence_blocked" };
  }

  const lookupDeliverectOrderId = resolveLookupDeliverectOrderId(vo);
  if (!lookupDeliverectOrderId) {
    console.warn(
      `${LOG} fallback_match_not_found reason=no_deliverect_order_id vendorOrderId=${vendorOrderId} channelOrderId_expected=${vo.id}`
    );
    return {
      outcome: "no_match",
      reason: "missing_deliverect_order_id_for_lookup_set_stored_id_after_successful_submit",
    };
  }

  console.info(
    `${LOG} fallback_lookup_key_used vendorOrderId=${vendorOrderId} lookupDeliverectOrderId=${lookupDeliverectOrderId} channelOrderId=${vo.id}`
  );

  const fetched = await fetchDeliverectOrderById(lookupDeliverectOrderId);
  if (!fetched.ok) {
    console.warn(
      `${LOG} fallback_match_not_found vendorOrderId=${vendorOrderId} httpStatus=${fetched.httpStatus} error=${fetched.error}`
    );
    return {
      outcome: "no_match",
      reason: `deliverect_get_failed:${fetched.error}`,
      lookupDeliverectOrderId,
    };
  }

  const match = matchDeliverectGetOrderResponseToVendorOrder(
    fetched.body,
    vo.id,
    lookupDeliverectOrderId,
    vo.deliverectOrderId
  );
  if (!match.match) {
    console.warn(
      `${LOG} fallback_match_ambiguous vendorOrderId=${vendorOrderId} reason=${match.reason} lookupDeliverectOrderId=${lookupDeliverectOrderId}`
    );
    return { outcome: "ambiguous", reason: match.reason };
  }

  console.info(
    `${LOG} fallback_match_found trigger=${trigger} vendorOrderId=${vendorOrderId} lookupDeliverectOrderId=${lookupDeliverectOrderId}`
  );

  const applyResult = await applyDeliverectStatusFromFallbackLookup(
    vendorOrderId,
    lookupDeliverectOrderId,
    fetched.body
  );

  if (applyResult.updatedVendorOrderState) {
    const mins =
      vo.deliverectSubmittedAt != null
        ? Math.max(0, Math.floor((now.getTime() - vo.deliverectSubmittedAt.getTime()) / 60_000))
        : null;
    if (mins != null && mins >= DELIVERECT_RECONCILIATION_STALE_MINUTES) {
      console.info(
        `${LOG} fallback_resolved_overdue vendorOrderId=${vendorOrderId} minutesAfterSubmit=${mins} threshold=${DELIVERECT_RECONCILIATION_STALE_MINUTES}`
      );
    }
    console.info(
      `${LOG} fallback_applied vendorOrderId=${vendorOrderId} outcome=${applyResult.outcome} updated=true`
    );
    return {
      outcome: "applied",
      deliverectWebhookApplyOutcome: applyResult.outcome,
      updatedVendorOrderState: true,
      lookupDeliverectOrderId,
    };
  }

  console.info(
    `${LOG} fallback_applied_no_row_change vendorOrderId=${vendorOrderId} pipelineOutcome=${applyResult.outcome}`
  );
  return {
    outcome: "noop",
    deliverectWebhookApplyOutcome: applyResult.outcome,
  };
}
