/**
 * Admin-facing Deliverect webhook incidents — combines WebhookEvent rows and VendorOrder.deliverectWebhookLastApply audits.
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DeliverectWebhookLastApplyRecord } from "@/domain/deliverect-webhook-apply";
import {
  flattenDeliverectWebhookPayload,
  resolveMennyuVendorOrderId,
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";

/** Aligns with structured log / operator vocabulary. */
export type DeliverectWebhookIncidentCategory =
  | "verification_failed"
  | "match_failed"
  | "apply_error"
  | "unmapped_status"
  | "duplicate_ignored"
  | "noop_same_status"
  | "ignored_backward"
  | "late_webhook"
  | "applied_successfully";

export type DeliverectWebhookIncidentPhase =
  | "rejected_before_apply"
  | "pipeline_processed"
  | "matched_audit_only"
  | "applied_state_update"
  | "not_persisted";

export type DeliverectWebhookIncidentSource = "webhook_event" | "vendor_order_audit";

export interface DeliverectWebhookIncidentRow {
  id: string;
  source: DeliverectWebhookIncidentSource;
  timestamp: Date;
  category: DeliverectWebhookIncidentCategory;
  phase: DeliverectWebhookIncidentPhase;
  summary: string;
  /** UI label (aligned with log event naming where possible). */
  label: string;
  eventId: string | null;
  idempotencyKey: string | null;
  vendorOrderId: string | null;
  orderId: string | null;
  vendorId: string | null;
  vendorName: string | null;
  errorMessage: string | null;
  /** From deliverectWebhookLastApply when source is vendor_order_audit */
  applyOutcome: DeliverectWebhookLastApplyRecord["outcome"] | null;
  applySource: "webhook" | "fallback" | null;
  manualRecoveryContext: boolean;
  fallbackEpisodeContext: boolean;
  overdueReconciliationContext: boolean;
}

export interface DeliverectWebhookIncidentSummary {
  since: Date;
  verificationFailed: number;
  matchFailed: number;
  applyErrors: number;
  unmappedStatus: number;
  lateWebhook: number;
}

export interface FetchDeliverectWebhookIncidentsParams {
  since: Date;
  /** Max rows to scan from each source before merge. */
  limit?: number;
  /** Filter by category; omit for all. */
  category?: DeliverectWebhookIncidentCategory | "all";
  /** Search substring for vendorOrderId, orderId, idempotencyKey, eventId. */
  search?: string;
  /** When false (default), omit applied_successfully and noop_same_status unless category forces them. */
  includeRoutine?: boolean;
}

function safeParseApply(json: Prisma.JsonValue | null): DeliverectWebhookLastApplyRecord | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (typeof o.outcome !== "string") return null;
  return o as unknown as DeliverectWebhookLastApplyRecord;
}

function extractVoIdFromPayload(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object") return null;
  const flat = flattenDeliverectWebhookPayload(payload as DeliverectWebhookPayload);
  return resolveMennyuVendorOrderId(flat);
}

function categorizeWebhookEvent(row: {
  id: string;
  provider: string;
  eventId: string | null;
  idempotencyKey: string | null;
  payload: Prisma.JsonValue;
  processed: boolean;
  errorMessage: string | null;
  createdAt: Date;
}): DeliverectWebhookIncidentRow | null {
  const payload = row.payload as Record<string, unknown> | null;
  const isRejection = payload?.kind === "order_webhook_rejection";
  const reason = typeof payload?.reason === "string" ? payload.reason : null;

  let category: DeliverectWebhookIncidentCategory;
  let label: string;
  let summary: string;
  let phase: DeliverectWebhookIncidentPhase;

  if (isRejection) {
    category = "verification_failed";
    phase = "rejected_before_apply";
    if (reason === "invalid_json") {
      label = "Verification failed (invalid JSON)";
      summary = "Request body was not valid JSON or not an object.";
    } else if (reason === "missing_verification_secret") {
      label = "Verification failed (missing secret)";
      summary = "HMAC secret could not be resolved (production partner secret or staging channel link id).";
    } else {
      label = "Verification failed (bad signature)";
      summary = "HMAC did not match configured secret(s).";
    }
  } else if (row.errorMessage?.includes("match_failed")) {
    category = "match_failed";
    phase = "rejected_before_apply";
    label = "No matching VendorOrder";
    summary = "Payload could not be linked to a Mennyu vendor order (channel / external id).";
  } else if (!row.processed && row.errorMessage) {
    category = "apply_error";
    phase = "pipeline_processed";
    label = "Webhook apply error";
    summary = row.errorMessage.slice(0, 200);
  } else if (row.processed && !row.errorMessage && !isRejection) {
    category = "applied_successfully";
    phase = "pipeline_processed";
    label = "Pipeline accepted (webhook event stored)";
    summary = "Signature OK, VendorOrder matched, apply handler completed without WebhookEvent error.";
  } else {
    return null;
  }

  const vendorOrderId = extractVoIdFromPayload(row.payload) ?? null;

  return {
    id: `we:${row.id}`,
    source: "webhook_event",
    timestamp: row.createdAt,
    category,
    phase,
    summary,
    label,
    eventId: row.eventId,
    idempotencyKey: row.idempotencyKey,
    vendorOrderId,
    orderId: null,
    vendorId: null,
    vendorName: null,
    errorMessage: row.errorMessage,
    applyOutcome: null,
    applySource: null,
    manualRecoveryContext: false,
    fallbackEpisodeContext: false,
    overdueReconciliationContext: false,
  };
}

function categorizeVendorOrderAudit(args: {
  voId: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  updatedAt: Date;
  apply: DeliverectWebhookLastApplyRecord;
}): DeliverectWebhookIncidentRow {
  const a = args.apply;
  const outcome = a.outcome;
  let category: DeliverectWebhookIncidentCategory;
  let label: string;
  let summary: string;
  const phase: DeliverectWebhookIncidentPhase = "matched_audit_only";

  const manualRecoveryContext =
    typeof a.detail === "string" &&
    (a.detail.includes("manual recovery") || a.detail.includes("Manual recovery"));
  const fallbackEpisodeContext =
    typeof a.detail === "string" && a.detail.includes("automatic Deliverect recheck");
  const overdueReconciliationContext = a.reconciledAfterStaleThreshold === true;

  if (outcome === "unmapped_status") {
    category = "unmapped_status";
    label = "Unmapped status recorded";
    summary = `POS sent a status code/event with no Mennyu mapping (code ${a.rawNumericCode ?? "—"}). State unchanged; audit only.`;
  } else if (outcome === "noop_same_status") {
    category = "noop_same_status";
    label = "No-op (same status)";
    summary = "Mapped status matched current Mennyu state after merge — no row change.";
  } else if (outcome === "ignored_backward") {
    category = "ignored_backward";
    label = "Ignored backward";
    summary = "POS proposed a lower fulfillment step than current — ignored for monotonicity.";
  } else if (outcome === "applied") {
    if (overdueReconciliationContext) {
      category = "late_webhook";
      label = "Applied after overdue delay";
      summary = `First POS signal after ${a.minutesAfterDeliverectSubmit ?? "—"} min from submit (stale threshold).`;
    } else if (manualRecoveryContext) {
      category = "late_webhook";
      label = "Applied after manual recovery";
      summary = "Webhook applied while vendor order had a manual recovery episode — POS still authoritative.";
    } else if (fallbackEpisodeContext) {
      category = "late_webhook";
      label = "Applied after fallback episode";
      summary = "Webhook arrived after a prior automatic Deliverect recheck episode on this row.";
    } else {
      category = "applied_successfully";
      label = "Applied successfully";
      summary = "Vendor order updated from Deliverect webhook.";
    }
  } else {
    category = "applied_successfully";
    label = "Webhook audit";
    summary = "Deliverect webhook apply record present.";
  }

  return {
    id: `vo:${args.voId}:${args.updatedAt.getTime()}`,
    source: "vendor_order_audit",
    timestamp: args.updatedAt,
    category,
    phase,
    summary,
    label,
    eventId: null,
    idempotencyKey: null,
    vendorOrderId: args.voId,
    orderId: args.orderId,
    vendorId: args.vendorId,
    vendorName: args.vendorName,
    errorMessage: null,
    applyOutcome: outcome,
    applySource: a.applySource ?? null,
    manualRecoveryContext,
    fallbackEpisodeContext,
    overdueReconciliationContext,
  };
}

const ROUTINE_CATEGORIES: DeliverectWebhookIncidentCategory[] = ["applied_successfully", "noop_same_status"];

export async function fetchDeliverectWebhookIncidentSummary(since: Date): Promise<DeliverectWebhookIncidentSummary> {
  const [webhookRows, vendorRows] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { provider: "deliverect", createdAt: { gte: since } },
      select: {
        payload: true,
        processed: true,
        errorMessage: true,
      },
    }),
    prisma.vendorOrder.findMany({
      where: {
        deliverectWebhookLastApply: { not: Prisma.DbNull },
        updatedAt: { gte: since },
      },
      select: { deliverectWebhookLastApply: true },
    }),
  ]);

  let verificationFailed = 0;
  let matchFailed = 0;
  let applyErrors = 0;
  for (const row of webhookRows) {
    const p = row.payload as Record<string, unknown> | null;
    if (p?.kind === "order_webhook_rejection") {
      verificationFailed++;
      continue;
    }
    if (row.errorMessage?.includes("match_failed")) matchFailed++;
    else if (!row.processed && row.errorMessage) applyErrors++;
  }

  let unmappedStatus = 0;
  let lateWebhook = 0;
  for (const vo of vendorRows) {
    const a = safeParseApply(vo.deliverectWebhookLastApply);
    if (!a) continue;
    if (a.outcome === "unmapped_status") unmappedStatus++;
    if (a.outcome === "applied" && a.reconciledAfterStaleThreshold === true) lateWebhook++;
  }

  return {
    since,
    verificationFailed,
    matchFailed,
    applyErrors,
    unmappedStatus,
    lateWebhook,
  };
}

export async function fetchDeliverectWebhookIncidents(
  params: FetchDeliverectWebhookIncidentsParams
): Promise<DeliverectWebhookIncidentRow[]> {
  const limit = params.limit ?? 120;
  const since = params.since;
  const search = params.search?.trim().toLowerCase() ?? "";
  const includeRoutine = params.includeRoutine ?? false;
  const catFilter = params.category ?? "all";

  const [webhookRows, vendorRows] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { provider: "deliverect", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        provider: true,
        eventId: true,
        idempotencyKey: true,
        payload: true,
        processed: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.vendorOrder.findMany({
      where: {
        deliverectWebhookLastApply: { not: Prisma.DbNull },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderId: true,
        vendorId: true,
        updatedAt: true,
        deliverectWebhookLastApply: true,
        vendor: { select: { name: true } },
      },
    }),
  ]);

  let fromEvents: DeliverectWebhookIncidentRow[] = [];
  for (const row of webhookRows) {
    const inc = categorizeWebhookEvent(row);
    if (inc) fromEvents.push(inc);
  }

  const voIdsForEvents = [...new Set(fromEvents.map((r) => r.vendorOrderId).filter((x): x is string => Boolean(x)))];
  if (voIdsForEvents.length > 0) {
    const vos = await prisma.vendorOrder.findMany({
      where: { id: { in: voIdsForEvents } },
      select: { id: true, orderId: true, vendorId: true, vendor: { select: { name: true } } },
    });
    const byVo = new Map(vos.map((v) => [v.id, v]));
    fromEvents = fromEvents.map((r) => {
      if (!r.vendorOrderId) return r;
      const v = byVo.get(r.vendorOrderId);
      if (!v) return r;
      return {
        ...r,
        orderId: v.orderId,
        vendorId: v.vendorId,
        vendorName: v.vendor.name,
      };
    });
  }

  const fromAudit: DeliverectWebhookIncidentRow[] = [];
  for (const vo of vendorRows) {
    const apply = safeParseApply(vo.deliverectWebhookLastApply);
    if (!apply) continue;
    fromAudit.push(
      categorizeVendorOrderAudit({
        voId: vo.id,
        orderId: vo.orderId,
        vendorId: vo.vendorId,
        vendorName: vo.vendor.name,
        updatedAt: vo.updatedAt,
        apply,
      })
    );
  }

  let merged = [...fromEvents, ...fromAudit].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const matchesSearch = (r: DeliverectWebhookIncidentRow): boolean => {
    if (!search) return true;
    const hay = [
      r.vendorOrderId,
      r.orderId,
      r.idempotencyKey,
      r.eventId,
      r.vendorName,
      r.errorMessage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  };

  merged = merged.filter(matchesSearch);

  merged = merged.filter((r) => {
    if (catFilter !== "all" && r.category !== catFilter) return false;
    /** When browsing all types, hide routine success/no-op unless explicitly requested. */
    const hideRoutine = catFilter === "all" && !includeRoutine;
    if (hideRoutine && ROUTINE_CATEGORIES.includes(r.category)) return false;
    return true;
  });

  return merged.slice(0, limit);
}
