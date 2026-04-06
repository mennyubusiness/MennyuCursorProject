import Link from "next/link";
import {
  buildDeliverectAdminLifecycle,
  getDeliverectAdminActionGuidance,
  shouldShowDeliverectAdminDiagnostics,
  type DeliverectAdminVoInput,
} from "@/lib/deliverect-admin-lifecycle";
import {
  lastDeliverectResponsePendingWebhookFlag,
  minutesSinceDeliverectSubmit,
} from "@/lib/deliverect-reconciliation-helpers";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { DeliverectPayloadValidationSnapshot } from "@/integrations/deliverect/payload-validation";
import type { VendorOrderStatusAuthority, VendorOrderStatusSource } from "@prisma/client";

type VoRow = AdminOrderDetail["vendorOrders"][number];

function jsonBlock(value: unknown, maxChars: number): string {
  if (value == null) return "—";
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n… (truncated)`;
  } catch {
    return String(value);
  }
}

function formatWhen(d: Date | null | undefined, fallback = "—"): string {
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function isPayloadValidationSnapshot(v: unknown): v is DeliverectPayloadValidationSnapshot {
  return (
    v != null &&
    typeof v === "object" &&
    "isValid" in v &&
    (v as DeliverectPayloadValidationSnapshot).isValid === false &&
    Array.isArray((v as DeliverectPayloadValidationSnapshot).errors)
  );
}

function DeliverectPayloadValidationBlock({ raw }: { raw: unknown }) {
  if (!isPayloadValidationSnapshot(raw)) return null;
  const s = raw;
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50/90 px-2.5 py-2 text-xs text-red-950">
      <p className="font-semibold">Pre-submit payload validation</p>
      <p className="mt-0.5 font-medium">{s.summary}</p>
      <p className="mt-1 text-[11px] text-red-900/90">
        {s.validatedAt ? `Validated ${formatWhen(new Date(s.validatedAt))}` : null}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer font-medium text-red-900 hover:underline">
          Detailed errors ({s.errors.length})
        </summary>
        <ul className="mt-2 list-none space-y-2 border-t border-red-200/80 pt-2">
          {s.errors.map((e, i) => (
            <li
              key={i}
              className="rounded border border-red-100 bg-white/80 px-2 py-1.5 font-mono text-[10px] leading-snug"
            >
              <span className="text-red-700">{e.severity}</span> ·{" "}
              <span className="text-red-800">{e.type}</span>
              <div className="mt-0.5 text-stone-800">{e.message}</div>
              <div className="mt-0.5 text-stone-500">{e.path}</div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function toLifecycleInput(vo: VoRow): DeliverectAdminVoInput {
  return {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    lastExternalStatus: vo.lastExternalStatus,
    deliverectOrderId: vo.deliverectOrderId,
    lastDeliverectResponse: vo.lastDeliverectResponse,
    lastExternalStatusAt: vo.lastExternalStatusAt,
    deliverectSubmittedAt: vo.deliverectSubmittedAt,
    createdAt: vo.createdAt,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
    statusAuthority: vo.statusAuthority as VendorOrderStatusAuthority | null,
    lastStatusSource: vo.lastStatusSource as VendorOrderStatusSource | null,
    deliverectAutoRecheckAttemptedAt: vo.deliverectAutoRecheckAttemptedAt,
    deliverectAutoRecheckResult: vo.deliverectAutoRecheckResult,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
    deliverectLastError: vo.deliverectLastError,
  };
}

export function AdminDeliverectDiagnosticsPanel({ vo }: { vo: VoRow }) {
  if (!shouldShowDeliverectAdminDiagnostics(vo)) return null;

  const now = new Date();
  const live = isRoutingRetryAvailable();
  const life = buildDeliverectAdminLifecycle(toLifecycleInput(vo), {
    now,
    routingModeDeliverect: live,
  });
  const guidance = getDeliverectAdminActionGuidance(toLifecycleInput(vo), {
    now,
    routingModeDeliverect: live,
  });

  const snap = toLifecycleInput(vo);
  const minsSubmit = minutesSinceDeliverectSubmit(snap, now);
  const pendingIdFlag = lastDeliverectResponsePendingWebhookFlag(vo.lastDeliverectResponse);
  const externalIdNote = vo.deliverectOrderId?.trim()
    ? `Yes (${vo.deliverectOrderId})`
    : pendingIdFlag
      ? "Not in DB yet (submit flagged id via webhook)"
      : "Not stored";

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 text-sm text-stone-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold text-stone-900">Deliverect</h4>
        <span className="text-xs text-stone-500">{life.routingProviderLabel}</span>
      </div>
      <p className="mt-1.5 text-xs">
        <Link
          href={`/admin/vendors/${vo.vendorId}/deliverect-mapping`}
          className="font-medium text-stone-700 underline hover:text-stone-900"
        >
          Menu mapping & integrity →
        </Link>
      </p>
      <div
        className={`mt-2 rounded-md border px-2.5 py-2 text-xs ${
          guidance.severity === "urgent"
            ? "border-red-200 bg-red-50/90 text-red-950"
            : guidance.severity === "attention"
              ? "border-amber-200 bg-amber-50/90 text-amber-950"
              : guidance.severity === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-950"
                : "border-stone-200 bg-white text-stone-800"
        }`}
      >
        <p className="font-semibold leading-snug">Next step</p>
        <p className="mt-0.5 font-medium">{guidance.recommendedAction}</p>
        <p className="mt-1 text-[11px] leading-relaxed opacity-95">{guidance.stateSummary}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-stone-600">
          {guidance.manualRecoveryBlocksAuto ? "Manual recovery blocks auto fallback · " : ""}
          {guidance.automaticFallbackAttempted
            ? "Automatic re-check attempted"
            : "Automatic re-check not in this episode"}
        </p>
      </div>
      <p className="mt-2 text-xs font-medium text-stone-700">{life.phaseTitle}</p>
      <p className="mt-0.5 text-xs text-stone-600">{life.phaseDetail}</p>
      {life.operatorHints.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-stone-600">
          {life.operatorHints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-stone-500">Channel link</dt>
          <dd className="font-mono text-[11px] text-stone-800">
            {vo.deliverectChannelLinkId?.trim() || vo.vendor.deliverectChannelLinkId?.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Routing / fulfillment</dt>
          <dd>
            {vo.routingStatus} · {vo.fulfillmentStatus}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Authority / last source</dt>
          <dd>
            {vo.statusAuthority ?? "—"} · {vo.lastStatusSource ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Deliverect order id</dt>
          <dd className="break-all font-mono text-[11px]">{vo.deliverectOrderId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Submitted at</dt>
          <dd>{formatWhen(vo.deliverectSubmittedAt)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Minutes since submit</dt>
          <dd>{minsSubmit != null ? `${minsSubmit} min` : "—"}</dd>
        </div>
        <div>
          <dt className="text-stone-500">External id at submit</dt>
          <dd>{externalIdNote}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Awaiting reco / overdue</dt>
          <dd>
            {life.awaitingReconciliation ? "Yes" : "No"} · {life.overdueReconciliation ? "Overdue" : "Not overdue"} (
            threshold {DELIVERECT_RECONCILIATION_STALE_MINUTES} min)
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Last external status</dt>
          <dd>{vo.lastExternalStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Last external at</dt>
          <dd>{formatWhen(vo.lastExternalStatusAt)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Reconciled late</dt>
          <dd>{life.reconciledLate ? "Yes (first signal after threshold from submit)" : "No"}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Auto re-check</dt>
          <dd>
            {vo.deliverectAutoRecheckAttemptedAt
              ? `${formatWhen(vo.deliverectAutoRecheckAttemptedAt)} · ${vo.deliverectAutoRecheckResult ?? "—"}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Manual recovery</dt>
          <dd>{vo.manuallyRecoveredAt ? formatWhen(vo.manuallyRecoveredAt) : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-stone-500">Last Deliverect error</dt>
          <dd className="break-words text-amber-900">{vo.deliverectLastError ?? "—"}</dd>
        </div>
      </dl>

      <DeliverectPayloadValidationBlock raw={vo.deliverectPayloadValidation} />

      <div className="mt-3 space-y-2 border-t border-stone-200 pt-2">
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-stone-600 hover:text-stone-900">
            Raw: last Deliverect HTTP response
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-stone-200 bg-white p-2 text-[10px] leading-snug text-stone-700">
            {jsonBlock(vo.lastDeliverectResponse, 8000)}
          </pre>
        </details>
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-stone-600 hover:text-stone-900">
            Raw: last webhook apply audit
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-stone-200 bg-white p-2 text-[10px] leading-snug text-stone-700">
            {jsonBlock(vo.deliverectWebhookLastApply, 8000)}
          </pre>
        </details>
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-stone-600 hover:text-stone-900">
            Raw: last webhook payload (verbose)
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-stone-200 bg-white p-2 text-[10px] leading-snug text-stone-700">
            {jsonBlock(vo.lastWebhookPayload, 6000)}
          </pre>
        </details>
      </div>
    </div>
  );
}
