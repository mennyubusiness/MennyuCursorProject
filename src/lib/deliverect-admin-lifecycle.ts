/**
 * Plain-English Deliverect lifecycle for admin UI. Builds on
 * {@link deliverect-reconciliation-helpers} — does not duplicate overdue/awaiting clocks.
 *
 * Log alignment: uses the same thresholds as `[Deliverect reconciliation]` / `[Deliverect] fallback_*`
 * (DELIVERECT_RECONCILIATION_STALE_MINUTES from admin-exceptions).
 */

import type { VendorOrderStatusAuthority, VendorOrderStatusSource } from "@prisma/client";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";
import {
  getDeliverectReconciliationPhase,
  isAwaitingDeliverectReconciliation,
  isDeliverectReconciliationOverdue,
  lastDeliverectResponsePendingWebhookFlag,
  minutesSinceDeliverectSubmit,
  reconciliationClockStart,
  type DeliverectReconciliationSnapshot,
} from "@/lib/deliverect-reconciliation-helpers";

/** High-level lifecycle for operators (one primary label + supporting fields). */
export type DeliverectLifecyclePhaseKey =
  | "not_submitted"
  | "submitted_awaiting_reconciliation"
  | "reconciliation_overdue"
  | "reconciled_webhook"
  | "reconciled_fallback"
  | "reconciled_other"
  | "manually_recovered"
  | "routing_failed"
  | "routing_in_progress";

export type DeliverectAdminLifecycle = {
  phaseKey: DeliverectLifecyclePhaseKey;
  /** Short title for panel header */
  phaseTitle: string;
  /** One line elaboration */
  phaseDetail: string;
  routingProviderLabel: string;
  hasChannelLink: boolean;
  awaitingReconciliation: boolean;
  overdueReconciliation: boolean;
  /** First POS signal at or after stale window from submit */
  reconciledLate: boolean;
  /** Submit response tagged id pending webhook */
  syncExternalIdPending: boolean;
  operatorHints: string[];
};

export type DeliverectAdminVoInput = DeliverectReconciliationSnapshot & {
  lastExternalStatus?: string | null;
  deliverectLastError?: string | null;
  manuallyRecoveredAt?: Date | null;
  statusAuthority?: VendorOrderStatusAuthority | null;
  lastStatusSource?: VendorOrderStatusSource | null;
  deliverectAutoRecheckAttemptedAt?: Date | null;
  deliverectAutoRecheckResult?: string | null;
  deliverectChannelLinkId?: string | null;
  vendorDeliverectChannelLinkId?: string | null;
};

export function hasDeliverectChannelLink(vo: {
  deliverectChannelLinkId?: string | null;
  vendorDeliverectChannelLinkId?: string | null;
}): boolean {
  const a = vo.deliverectChannelLinkId?.trim();
  const b = vo.vendorDeliverectChannelLinkId?.trim();
  return Boolean(a || b);
}

/**
 * Show diagnostics when the slice is on or near the Deliverect path (channel, submit, or terminal routing).
 */
export function shouldShowDeliverectAdminDiagnostics(vo: {
  deliverectChannelLinkId?: string | null;
  vendorDeliverectChannelLinkId?: string | null;
  deliverectSubmittedAt?: Date | null;
  deliverectOrderId?: string | null;
  routingStatus: string;
}): boolean {
  if (hasDeliverectChannelLink(vo)) return true;
  if (vo.deliverectSubmittedAt) return true;
  if (vo.deliverectOrderId?.trim()) return true;
  if (vo.routingStatus === "sent" || vo.routingStatus === "confirmed" || vo.routingStatus === "failed") return true;
  return false;
}

/**
 * Awaiting first POS signal: same idea as cron/eligibility, but `confirmed`+`pending` is included for display
 * (strict eligibility in jobs still uses `sent` only).
 */
function awaitingFirstExternalSignal(vo: DeliverectAdminVoInput): boolean {
  if (vo.lastExternalStatusAt != null) return false;
  if (vo.fulfillmentStatus !== "pending") return false;
  return vo.routingStatus === "sent" || vo.routingStatus === "confirmed";
}

function overdueForAdmin(vo: DeliverectAdminVoInput, staleMinutes: number, now: Date): boolean {
  if (!awaitingFirstExternalSignal(vo)) return false;
  const start = reconciliationClockStart(vo);
  if (!start) return false;
  return now.getTime() - start.getTime() >= staleMinutes * 60_000;
}

function reconciledLate(
  vo: { deliverectSubmittedAt?: Date | null; lastExternalStatusAt?: Date | null },
  staleMinutes: number
): boolean {
  if (!vo.deliverectSubmittedAt || !vo.lastExternalStatusAt) return false;
  const delta = vo.lastExternalStatusAt.getTime() - vo.deliverectSubmittedAt.getTime();
  return delta >= staleMinutes * 60_000;
}

export function buildDeliverectAdminLifecycle(
  vo: DeliverectAdminVoInput,
  options?: { now?: Date; staleMinutes?: number; routingModeDeliverect?: boolean }
): DeliverectAdminLifecycle {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DELIVERECT_RECONCILIATION_STALE_MINUTES;
  const live = options?.routingModeDeliverect !== false;

  const snap: DeliverectReconciliationSnapshot = {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    deliverectOrderId: vo.deliverectOrderId,
    lastDeliverectResponse: vo.lastDeliverectResponse,
    lastExternalStatusAt: vo.lastExternalStatusAt,
    deliverectSubmittedAt: vo.deliverectSubmittedAt,
    createdAt: vo.createdAt,
  };

  const hasCh = hasDeliverectChannelLink(vo);
  const routingProviderLabel = live ? "Deliverect" : "Deliverect (disabled — ROUTING_MODE mock)";
  const syncExternalIdPending = lastDeliverectResponsePendingWebhookFlag(vo.lastDeliverectResponse);
  const mins = minutesSinceDeliverectSubmit(snap, now);

  const baseHints: string[] = [];
  if (vo.manuallyRecoveredAt != null) {
    baseHints.push("Manual recovery is blocking automatic Deliverect fallback.");
  }

  if (vo.deliverectAutoRecheckAttemptedAt != null && vo.deliverectAutoRecheckResult) {
    const r = vo.deliverectAutoRecheckResult;
    if (r.startsWith("error") || r === "no_match" || r === "ambiguous") {
      baseHints.push(`Automatic re-check result: ${r.replace(/^error:/, "error — ")}`);
    } else if (r === "applied") {
      baseHints.push("Reconciled via automatic API re-check (fallback).");
    }
  }

  if (vo.manuallyRecoveredAt != null) {
    return {
      phaseKey: "manually_recovered",
      phaseTitle: "Manually recovered",
      phaseDetail:
        "This slice was marked received outside the normal Deliverect webhook path; automatic fallback is suppressed.",
      routingProviderLabel,
      hasChannelLink: hasCh,
      awaitingReconciliation: false,
      overdueReconciliation: false,
      reconciledLate: false,
      syncExternalIdPending,
      operatorHints: baseHints,
    };
  }

  if (vo.routingStatus === "failed") {
    return {
      phaseKey: "routing_failed",
      phaseTitle: "Routing failed",
      phaseDetail: "Deliverect submit did not succeed; see last error below.",
      routingProviderLabel,
      hasChannelLink: hasCh,
      awaitingReconciliation: false,
      overdueReconciliation: false,
      reconciledLate: false,
      syncExternalIdPending,
      operatorHints: baseHints,
    };
  }

  if (vo.routingStatus === "pending") {
    return {
      phaseKey: "not_submitted",
      phaseTitle: "Not submitted to Deliverect",
      phaseDetail: "Routing is still pending; order has not been sent to Deliverect yet.",
      routingProviderLabel,
      hasChannelLink: hasCh,
      awaitingReconciliation: false,
      overdueReconciliation: false,
      reconciledLate: false,
      syncExternalIdPending,
      operatorHints: baseHints,
    };
  }

  if (vo.lastExternalStatusAt != null) {
    const late = reconciledLate(vo, staleMinutes);
    const src = vo.lastStatusSource;
    let phaseKey: DeliverectLifecyclePhaseKey = "reconciled_other";
    let phaseTitle = "Reconciled";
    let phaseDetail = `Last external status: ${vo.lastExternalStatus ?? "—"}.`;

    if (src === "deliverect_webhook") {
      phaseKey = "reconciled_webhook";
      phaseTitle = late ? "Reconciled by webhook (late)" : "Reconciled by webhook";
      phaseDetail = late
        ? `First POS signal arrived after the usual ${staleMinutes}-minute window. Last: ${vo.lastExternalStatus ?? "—"}.`
        : `POS signal from Deliverect webhook. Last: ${vo.lastExternalStatus ?? "—"}.`;
    } else if (src === "deliverect_fallback") {
      phaseKey = "reconciled_fallback";
      phaseTitle = late ? "Reconciled by fallback (late)" : "Reconciled by fallback";
      phaseDetail = late
        ? `Status applied via GET/API reconciliation after the webhook window. Last: ${vo.lastExternalStatus ?? "—"}.`
        : `Status applied via GET/API reconciliation. Last: ${vo.lastExternalStatus ?? "—"}.`;
    } else if (src != null) {
      phaseDetail = `Source: ${src.replace(/_/g, " ")}. Last: ${vo.lastExternalStatus ?? "—"}.`;
    }

    if (late && phaseKey === "reconciled_other") {
      phaseTitle = "Reconciled (late)";
      phaseDetail = `First external signal arrived after ${staleMinutes}+ minutes from submit.`;
    }

    return {
      phaseKey,
      phaseTitle,
      phaseDetail,
      routingProviderLabel,
      hasChannelLink: hasCh,
      awaitingReconciliation: false,
      overdueReconciliation: false,
      reconciledLate: late,
      syncExternalIdPending: false,
      operatorHints: baseHints,
    };
  }

  // No external signal yet
  const strictPhase = getDeliverectReconciliationPhase(snap, { now, staleMinutes });
  const awaitingStrict = isAwaitingDeliverectReconciliation(snap);
  const awaitingDisplay = awaitingFirstExternalSignal(vo);
  const overdueStrict = isDeliverectReconciliationOverdue(snap, staleMinutes, now);
  const overdueDisplay = overdueForAdmin(vo, staleMinutes, now);

  if (awaitingDisplay) {
    const ageHint =
      mins != null
        ? `Submitted ${mins} minute${mins === 1 ? "" : "s"} ago; no external status received yet.`
        : "Waiting for external confirmation from Deliverect/POS.";
    if (overdueDisplay || overdueStrict || strictPhase === "overdue_reconciliation") {
      return {
        phaseKey: "reconciliation_overdue",
        phaseTitle: "Reconciliation overdue",
        phaseDetail: `No POS webhook confirmation after ${staleMinutes}+ minutes (missing lastExternalStatusAt).`,
        routingProviderLabel,
        hasChannelLink: hasCh,
        awaitingReconciliation: true,
        overdueReconciliation: true,
        reconciledLate: false,
        syncExternalIdPending,
        operatorHints: [...baseHints, ageHint],
      };
    }
    return {
      phaseKey: "submitted_awaiting_reconciliation",
      phaseTitle: "Submitted, awaiting reconciliation",
      phaseDetail:
        "Waiting for first webhook-driven POS signal (lastExternalStatusAt). Within the normal window if recently submitted.",
      routingProviderLabel,
      hasChannelLink: hasCh,
      awaitingReconciliation: awaitingStrict || awaitingDisplay,
      overdueReconciliation: false,
      reconciledLate: false,
      syncExternalIdPending,
      operatorHints: [...baseHints, ageHint],
    };
  }

  return {
    phaseKey: "routing_in_progress",
    phaseTitle: "Routing in progress",
    phaseDetail: `Routing: ${vo.routingStatus}; fulfillment: ${vo.fulfillmentStatus ?? "—"}.`,
    routingProviderLabel,
    hasChannelLink: hasCh,
    awaitingReconciliation: false,
    overdueReconciliation: false,
    reconciledLate: false,
    syncExternalIdPending,
    operatorHints: baseHints,
  };
}

export type DeliverectCompactBadge = { label: string; className: string };

/** Operator-facing severity for recommended actions (UI tinting). */
export type DeliverectActionSeverity = "info" | "attention" | "success" | "urgent";

/** Single place for “what to do next” copy — driven by {@link buildDeliverectAdminLifecycle} + auto re-check codes. */
export type DeliverectAdminActionGuidance = {
  /** Short headline (often matches phase title) */
  phaseLabel: string;
  /** One line: current situation */
  stateSummary: string;
  /** What ops should do next */
  recommendedAction: string;
  severity: DeliverectActionSeverity;
  /** True once automatic fallback has run this episode */
  automaticFallbackAttempted: boolean;
  /** Auto paths blocked by manual recovery */
  manualRecoveryBlocksAuto: boolean;
};

function parseAutoRecheckResult(raw: string | null | undefined): {
  code: string;
  isError: boolean;
} {
  const r = raw?.trim() ?? "";
  if (!r) return { code: "", isError: false };
  if (r.startsWith("error:") || r.startsWith("error")) return { code: r, isError: true };
  const colon = r.indexOf(":");
  const head = colon === -1 ? r : r.slice(0, colon);
  return { code: head, isError: false };
}

export function getDeliverectAdminActionGuidance(
  vo: DeliverectAdminVoInput,
  options?: { now?: Date; staleMinutes?: number; routingModeDeliverect?: boolean }
): DeliverectAdminActionGuidance {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DELIVERECT_RECONCILIATION_STALE_MINUTES;
  const life = buildDeliverectAdminLifecycle(vo, options);
  const snap: DeliverectReconciliationSnapshot = {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    deliverectOrderId: vo.deliverectOrderId,
    lastDeliverectResponse: vo.lastDeliverectResponse,
    lastExternalStatusAt: vo.lastExternalStatusAt,
    deliverectSubmittedAt: vo.deliverectSubmittedAt,
    createdAt: vo.createdAt,
  };
  const mins = minutesSinceDeliverectSubmit(snap, now);
  const autoAttempted = vo.deliverectAutoRecheckAttemptedAt != null;
  const { code: autoCode, isError: autoErr } = parseAutoRecheckResult(vo.deliverectAutoRecheckResult);
  const manualBlocks = vo.manuallyRecoveredAt != null;

  const ageLine =
    mins != null
      ? `Submitted ${mins} minute${mins === 1 ? "" : "s"} ago; no external status received yet.`
      : "Waiting for external confirmation from Deliverect/POS.";

  if (manualBlocks) {
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: "Manual recovery is active on this vendor order.",
      recommendedAction:
        "Manual recovery is active; reconcile carefully. Automatic Deliverect fallback will not run until policy allows.",
      severity: "attention",
      automaticFallbackAttempted: autoAttempted,
      manualRecoveryBlocksAuto: true,
    };
  }

  if (life.phaseKey === "routing_failed") {
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: vo.deliverectLastError
        ? `Routing failed: ${vo.deliverectLastError.slice(0, 100)}${vo.deliverectLastError.length > 100 ? "…" : ""}`
        : "Deliverect rejected or failed the submit.",
      recommendedAction: "Retry routing or investigate payload/channel configuration.",
      severity: "urgent",
      automaticFallbackAttempted: autoAttempted,
      manualRecoveryBlocksAuto: false,
    };
  }

  if (life.phaseKey === "not_submitted") {
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: "This slice has not been sent to Deliverect yet.",
      recommendedAction: "Wait for routing to finish, or use primary actions if routing is stuck.",
      severity: "info",
      automaticFallbackAttempted: false,
      manualRecoveryBlocksAuto: false,
    };
  }

  if (
    life.phaseKey === "reconciled_webhook" ||
    life.phaseKey === "reconciled_fallback" ||
    life.phaseKey === "reconciled_other"
  ) {
    const late = life.reconciledLate;
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: late
        ? `External status arrived after the usual ${staleMinutes}-minute window.`
        : "POS/external status is synced.",
      recommendedAction: late ? "No action needed." : "No action needed unless the kitchen reports an issue.",
      severity: "success",
      automaticFallbackAttempted: autoAttempted,
      manualRecoveryBlocksAuto: false,
    };
  }

  if (life.phaseKey === "routing_in_progress") {
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: life.phaseDetail,
      recommendedAction: "Monitor routing and fulfillment; use order actions if something looks wrong.",
      severity: "info",
      automaticFallbackAttempted: autoAttempted,
      manualRecoveryBlocksAuto: false,
    };
  }

  // Awaiting or overdue (no external signal yet)
  if (life.phaseKey === "submitted_awaiting_reconciliation") {
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: ageLine,
      recommendedAction: "Wait for external confirmation from Deliverect/POS.",
      severity: "info",
      automaticFallbackAttempted: autoAttempted,
      manualRecoveryBlocksAuto: false,
    };
  }

  if (life.phaseKey === "reconciliation_overdue") {
    const rawAuto = vo.deliverectAutoRecheckResult ?? "";
    if (autoCode === "no_match" || rawAuto.includes("no_match")) {
      return {
        phaseLabel: "Reconciliation overdue · automatic re-check",
        stateSummary: "Automatic re-check ran but could not match a Deliverect order to this slice.",
        recommendedAction: "Manual review or manual recovery may be needed. Confirm channel order id and mapping.",
        severity: "urgent",
        automaticFallbackAttempted: true,
        manualRecoveryBlocksAuto: false,
      };
    }
    if (autoCode === "ambiguous") {
      return {
        phaseLabel: "Reconciliation overdue · automatic re-check",
        stateSummary: "Automatic re-check found multiple possible matches.",
        recommendedAction: "Manual review required before applying status changes.",
        severity: "urgent",
        automaticFallbackAttempted: true,
        manualRecoveryBlocksAuto: false,
      };
    }
    if (autoErr || autoCode === "error") {
      return {
        phaseLabel: "Reconciliation overdue · automatic re-check",
        stateSummary: "Automatic re-check failed with an error.",
        recommendedAction: "Check logs and Deliverect health; try manual Re-check Deliverect from the order.",
        severity: "urgent",
        automaticFallbackAttempted: true,
        manualRecoveryBlocksAuto: false,
      };
    }
    if (autoCode === "applied" || autoCode === "noop") {
      return {
        phaseLabel: life.phaseTitle,
        stateSummary: ageLine + " Automatic re-check already ran.",
        recommendedAction:
          autoCode === "noop"
            ? "Monitor; automatic re-check did not change status. Use manual Re-check if still wrong."
            : "Monitor; status may have updated. Refresh the order if needed.",
        severity: "attention",
        automaticFallbackAttempted: true,
        manualRecoveryBlocksAuto: false,
      };
    }
    if (!autoAttempted) {
      return {
        phaseLabel: life.phaseTitle,
        stateSummary: ageLine,
        recommendedAction: "Monitor or use Re-check Deliverect if webhooks are delayed. Automatic fallback may run on schedule.",
        severity: "attention",
        automaticFallbackAttempted: false,
        manualRecoveryBlocksAuto: false,
      };
    }
    return {
      phaseLabel: life.phaseTitle,
      stateSummary: ageLine,
      recommendedAction: "Monitor or use manual Re-check Deliverect; review automatic re-check result on the order.",
      severity: "attention",
      automaticFallbackAttempted: true,
      manualRecoveryBlocksAuto: false,
    };
  }

  return {
    phaseLabel: life.phaseTitle,
    stateSummary: life.phaseDetail,
    recommendedAction: "Review Deliverect diagnostics on the order.",
    severity: "info",
    automaticFallbackAttempted: autoAttempted,
    manualRecoveryBlocksAuto: false,
  };
}

/** High-signal pills for list rows (max 4 labels; priority-ordered). */
export function getDeliverectAdminCompactBadges(
  vo: DeliverectAdminVoInput,
  options?: { now?: Date; staleMinutes?: number }
): DeliverectCompactBadge[] {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DELIVERECT_RECONCILIATION_STALE_MINUTES;
  const life = buildDeliverectAdminLifecycle(vo, { now, staleMinutes });
  const badges: DeliverectCompactBadge[] = [];
  const r = vo.deliverectAutoRecheckResult?.trim() ?? "";
  const autoParsed = parseAutoRecheckResult(vo.deliverectAutoRecheckResult);

  if (life.phaseKey === "manually_recovered") {
    badges.push({ label: "Manual recovery", className: "bg-emerald-100 text-emerald-900" });
  }
  if (life.phaseKey === "routing_failed") {
    badges.push({ label: "Routing failed", className: "bg-red-100 text-red-800" });
  }
  if (vo.deliverectAutoRecheckAttemptedAt != null) {
    if (autoParsed.code === "no_match" || r.includes("no_match")) {
      badges.push({ label: "Auto: no match", className: "bg-rose-100 text-rose-900" });
    } else if (autoParsed.code === "ambiguous") {
      badges.push({ label: "Auto: ambiguous", className: "bg-rose-100 text-rose-900" });
    } else if (autoParsed.isError) {
      badges.push({ label: "Auto re-check error", className: "bg-rose-100 text-rose-900" });
    } else {
      badges.push({ label: "Auto re-check", className: "bg-indigo-50 text-indigo-900" });
    }
  }
  if (life.overdueReconciliation) {
    badges.push({ label: "Reco overdue", className: "bg-amber-100 text-amber-900" });
  }
  if (life.awaitingReconciliation && !life.overdueReconciliation) {
    badges.push({ label: "Awaiting POS", className: "bg-slate-100 text-slate-700" });
  }
  if (life.reconciledLate) {
    badges.push({ label: "Late reco", className: "bg-orange-100 text-orange-900" });
  }

  return badges.slice(0, 4);
}
