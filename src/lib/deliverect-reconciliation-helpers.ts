/**
 * Derives Deliverect submit vs webhook reconciliation state from persisted VendorOrder fields.
 * Used for admin surfacing (`describeDeliverectReconciliationForAdmin`, `deliverect-admin-lifecycle`),
 * stalled heuristics, and logging — no new DB columns required.
 * Wording aligns with `[Deliverect reconciliation]` / `[Deliverect] fallback_*` log lines and
 * `DELIVERECT_RECONCILIATION_STALE_MINUTES` in admin-exceptions.
 */

import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";

export type DeliverectReconciliationSnapshot = {
  routingStatus: string;
  fulfillmentStatus?: string | null;
  deliverectOrderId?: string | null;
  lastDeliverectResponse?: unknown | null;
  lastExternalStatusAt?: Date | null;
  deliverectSubmittedAt?: Date | null;
  createdAt?: Date | null;
};

/** True when lastDeliverectResponse was tagged at submit time (HTTP 2xx, no id in body). */
export function lastDeliverectResponsePendingWebhookFlag(lastDeliverectResponse: unknown | null | undefined): boolean {
  if (lastDeliverectResponse == null || typeof lastDeliverectResponse !== "object") return false;
  const mennyu = (lastDeliverectResponse as { _mennyu?: { deliverectOrderIdPendingWebhook?: boolean } })._mennyu;
  return mennyu?.deliverectOrderIdPendingWebhook === true;
}

/**
 * Submitted to Deliverect (`routingStatus === sent`) but no POS webhook has yet produced
 * `lastExternalStatusAt` (first external signal). Optional id in DB from sync HTTP response
 * does not count as reconciliation complete.
 */
export function isAwaitingDeliverectReconciliation(vo: DeliverectReconciliationSnapshot): boolean {
  if (vo.routingStatus !== "sent") return false;
  if (vo.lastExternalStatusAt != null) return false;
  const f = vo.fulfillmentStatus ?? "pending";
  if (f !== "pending") return false;
  return true;
}

/** Best-effort clock start for "how long since submit" (for ops); prefers deliverectSubmittedAt. */
export function reconciliationClockStart(vo: DeliverectReconciliationSnapshot): Date | null {
  return vo.deliverectSubmittedAt ?? vo.createdAt ?? null;
}

/**
 * Minutes since `deliverectSubmittedAt` (or clock start), floored; null if no anchor.
 */
export function minutesSinceDeliverectSubmit(vo: DeliverectReconciliationSnapshot, now: Date): number | null {
  const start = reconciliationClockStart(vo);
  if (!start) return null;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60_000));
}

/**
 * Same predicate as admin attention `deliverect_reconciliation_overdue` (derived; no stored timeout flag).
 */
export function isDeliverectReconciliationOverdue(
  vo: DeliverectReconciliationSnapshot,
  staleMinutes: number,
  now: Date
): boolean {
  if (!isAwaitingDeliverectReconciliation(vo)) return false;
  const start = reconciliationClockStart(vo);
  if (!start) return false;
  return now.getTime() - start.getTime() >= staleMinutes * 60_000;
}

export type DeliverectReconciliationPhase =
  | "not_applicable"
  | "awaiting_reconciliation"
  | "overdue_reconciliation"
  | "reconciled";

/**
 * Lightweight classification for UI/diagnostics (all derived).
 * `reconciled` = first POS signal recorded (`lastExternalStatusAt`).
 */
export function getDeliverectReconciliationPhase(
  vo: DeliverectReconciliationSnapshot,
  options?: { staleMinutes?: number; now?: Date }
): DeliverectReconciliationPhase {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DELIVERECT_RECONCILIATION_STALE_MINUTES;

  if (vo.lastExternalStatusAt != null) {
    return "reconciled";
  }
  if (!isAwaitingDeliverectReconciliation(vo)) {
    return "not_applicable";
  }
  if (isDeliverectReconciliationOverdue(vo, staleMinutes, now)) {
    return "overdue_reconciliation";
  }
  return "awaiting_reconciliation";
}

/**
 * Short ops hint: wait vs intervene (does not replace admin judgment).
 */
export function deliverectReconciliationAdminActionHint(phase: DeliverectReconciliationPhase): string {
  switch (phase) {
    case "awaiting_reconciliation":
      return "Within normal webhook window — wait unless the kitchen reports a problem.";
    case "overdue_reconciliation":
      return "Past expected webhook window — check Deliverect channel mapping and webhook logs; retry routing if config changed, or manual recovery if the kitchen already has the order.";
    case "reconciled":
      return "POS signal received — no Deliverect reconciliation action needed for this gap.";
    default:
      return "See routing and fulfillment status on the vendor order.";
  }
}

/**
 * Plain-English line for admin/support (not shown to end customers).
 * Uses `staleMinutes` + `now` so "awaiting" vs "overdue" wording stays accurate (not misleading for fresh submits).
 */
export function describeDeliverectReconciliationForAdmin(
  vo: DeliverectReconciliationSnapshot,
  options?: { now?: Date; staleMinutes?: number }
): string {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DELIVERECT_RECONCILIATION_STALE_MINUTES;

  if (vo.routingStatus === "failed") {
    return "Deliverect routing failed; see deliverectLastError on the vendor order.";
  }
  if (vo.routingStatus === "pending") {
    return "Not yet submitted to Deliverect (routing still pending).";
  }
  if (vo.routingStatus !== "sent" && vo.routingStatus !== "confirmed") {
    return `Routing status: ${vo.routingStatus}.`;
  }

  if (vo.lastExternalStatusAt != null) {
    return `Deliverect-linked: last POS signal at ${vo.lastExternalStatusAt.toISOString()}.`;
  }

  if (!isAwaitingDeliverectReconciliation(vo)) {
    return "Deliverect submit recorded; reconciliation state is normal or confirmed.";
  }

  const idNote = vo.deliverectOrderId?.trim()
    ? `External order id: ${vo.deliverectOrderId}.`
    : "No external Deliverect order id stored yet (may arrive via webhook).";
  const pending = lastDeliverectResponsePendingWebhookFlag(vo.lastDeliverectResponse);
  const mins = minutesSinceDeliverectSubmit(vo, now);
  const agePart =
    mins != null ? `~${mins} minute${mins === 1 ? "" : "s"} since submit.` : "Submit time not recorded.";
  const overdue = isDeliverectReconciliationOverdue(vo, staleMinutes, now);
  const submitIso = vo.deliverectSubmittedAt ? ` Submitted at ${vo.deliverectSubmittedAt.toISOString()}.` : "";

  if (!overdue) {
    return [
      "Submitted to Deliverect; awaiting first POS webhook (no external confirmation yet).",
      agePart,
      submitIso.trim(),
      idNote,
      pending ? "Submit response indicated id may arrive via webhook." : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `No POS webhook confirmation after ${staleMinutes}+ minutes (missing lastExternalStatusAt).`,
    agePart,
    submitIso.trim(),
    idNote,
    pending ? "Submit response indicated id may arrive via webhook." : "",
    deliverectReconciliationAdminActionHint("overdue_reconciliation"),
  ]
    .filter(Boolean)
    .join(" ");
}
