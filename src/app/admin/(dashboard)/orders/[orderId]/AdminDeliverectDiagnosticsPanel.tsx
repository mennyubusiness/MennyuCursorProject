import Link from "next/link";
import {
  buildDeliverectAdminLifecycle,
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
import { formatAdminOrderDate, isSquareRoutedVendorOrder } from "@/lib/admin-order-detail-ui";
import {
  parseSquareOrderAudit,
  squareRoutingFailureGuidance,
} from "@/lib/integrations/square/square-order-audit";
import { SQUARE_TOTAL_MISMATCH_ADMIN_COPY } from "@/lib/integrations/square/square-order-total-comparison";
import { AdminDeliverectRecheck } from "./AdminDeliverectRecheck";
import { AdminVendorOrderOperationalPanel } from "./AdminVendorOrderOperationalPanel";

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
              <div className="mt-0.5 text-oo-charcoal">{e.message}</div>
              <div className="mt-0.5 text-oo-stone-gray">{e.path}</div>
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

/** Collapsed-by-default dense Square routing debug fields. */
export function AdminSquareRoutingTechnicalDetails({ vo }: { vo: VoRow }) {
  if (!isSquareRoutedVendorOrder(vo)) return null;

  const live = isRoutingRetryAvailable();
  const audit = parseSquareOrderAudit(vo.lastSquarePayload);
  const guidance = squareRoutingFailureGuidance({
    error: vo.squareLastError,
    squareRoutingLive: live,
    hasMappingIssues: Boolean(audit.mappingIssues),
  });

  return (
    <details className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-oo-stone-gray hover:text-oo-charcoal">
        Square routing details
      </summary>
      <div className="mt-3 space-y-3 text-xs text-oo-charcoal">
        <p className="text-oo-stone-gray">
          Retry Square routing uses Square idempotency keys to avoid duplicate Square orders.
        </p>

        {guidance ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-950">{guidance}</p>
        ) : null}

        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-oo-stone-gray">Provider</dt>
            <dd>Square{live ? "" : " (live routing disabled in env)"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Routing status</dt>
            <dd>{vo.routingStatus}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Square order id</dt>
            <dd className="break-all font-mono text-[11px]">{vo.squareOrderId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Square payment id</dt>
            <dd className="break-all font-mono text-[11px]">{audit.squarePaymentId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Payment status</dt>
            <dd>{audit.squarePaymentStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Attempts</dt>
            <dd>{vo.squareAttempts}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Submitted at</dt>
            <dd>{vo.squareSubmittedAt ? formatAdminOrderDate(vo.squareSubmittedAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Last attempted at</dt>
            <dd>{audit.squareLastAttemptAt ? formatAdminOrderDate(new Date(audit.squareLastAttemptAt)) : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-oo-stone-gray">Last error</dt>
            <dd className="text-red-900">{vo.squareLastError ?? "—"}</dd>
          </div>
        </dl>

        {audit.reconciliation ? (
          <div className="rounded-md border border-oo-light-stone bg-oo-warm-white px-2.5 py-2">
            <p className="font-semibold text-oo-charcoal">Total comparison</p>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-oo-stone-gray">OO subtotal</dt>
                <dd>{audit.reconciliation.ooSubtotalCents}¢</dd>
              </div>
              <div>
                <dt className="text-oo-stone-gray">OO tax</dt>
                <dd>{audit.reconciliation.ooTaxCents}¢</dd>
              </div>
              <div>
                <dt className="text-oo-stone-gray">OO food+tax total</dt>
                <dd>{audit.reconciliation.ooTotalCents}¢</dd>
              </div>
              <div>
                <dt className="text-oo-stone-gray">Square order total</dt>
                <dd>{audit.reconciliation.squareOrderTotalCents ?? "—"}¢</dd>
              </div>
              <div>
                <dt className="text-oo-stone-gray">Square external payment</dt>
                <dd>{audit.reconciliation.squareExternalPaymentCents ?? "—"}¢</dd>
              </div>
              <div>
                <dt className="text-oo-stone-gray">Difference</dt>
                <dd>{audit.reconciliation.squareTotalDifferenceCents ?? "—"}¢</dd>
              </div>
            </dl>
            {audit.reconciliation.mismatchWarning ? (
              <p className="mt-2 text-amber-900">{SQUARE_TOTAL_MISMATCH_ADMIN_COPY}</p>
            ) : null}
          </div>
        ) : null}

        {audit.mappingIssues ? (
          <div className="rounded-md border border-red-200 bg-red-50/90 px-2.5 py-2 text-xs text-red-950">
            <p className="font-semibold">Payload mapping issues</p>
            <pre className="mt-1 max-h-32 overflow-auto font-mono text-[10px]">
              {jsonBlock(audit.mappingIssues, 4000)}
            </pre>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-oo-light-stone pt-2">
          <details>
            <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
              Raw: last Square request audit
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-oo-light-stone bg-oo-warm-white p-2 font-mono text-[10px] leading-snug">
              {jsonBlock(vo.lastSquarePayload, 8000)}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
              Raw: last Square API response
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-oo-light-stone bg-oo-warm-white p-2 font-mono text-[10px] leading-snug">
              {jsonBlock(vo.lastSquareResponse, 8000)}
            </pre>
          </details>
        </div>
      </div>
    </details>
  );
}

/** Collapsed-by-default dense Deliverect / routing debug fields. */
export function AdminVendorOrderTechnicalRoutingDetails({
  vo,
  showRecheck,
}: {
  vo: VoRow;
  showRecheck?: boolean;
}) {
  if (isSquareRoutedVendorOrder(vo)) {
    return <AdminSquareRoutingTechnicalDetails vo={vo} />;
  }
  if (!shouldShowDeliverectAdminDiagnostics(vo)) return null;

  const now = new Date();
  const live = isRoutingRetryAvailable();
  const life = buildDeliverectAdminLifecycle(toLifecycleInput(vo), {
    now,
    routingModeDeliverect: live,
  });
  const snap = toLifecycleInput(vo);
  const minsSubmit = minutesSinceDeliverectSubmit(snap, now);
  const pendingIdFlag = lastDeliverectResponsePendingWebhookFlag(vo.lastDeliverectResponse);
  const externalIdNote = vo.deliverectOrderId?.trim()
    ? vo.deliverectOrderId
    : pendingIdFlag
      ? "Pending webhook (submit flagged id)"
      : "Not stored";

  return (
    <details className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-oo-stone-gray hover:text-oo-charcoal">
        Technical routing details
      </summary>
      <div className="mt-3 space-y-3 text-xs text-oo-charcoal">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-oo-stone-gray">Channel link</dt>
            <dd className="break-all font-mono text-[11px]">
              {vo.deliverectChannelLinkId?.trim() || vo.vendor.deliverectChannelLinkId?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Authority / source</dt>
            <dd>
              {vo.statusAuthority ?? "—"} · {vo.lastStatusSource ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Deliverect order id</dt>
            <dd className="break-all font-mono text-[11px]">{vo.deliverectOrderId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">External id at submit</dt>
            <dd className="break-all font-mono text-[11px]">{externalIdNote}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Submitted at</dt>
            <dd>{vo.deliverectSubmittedAt ? formatAdminOrderDate(vo.deliverectSubmittedAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Minutes since submit</dt>
            <dd>{minsSubmit != null ? `${minsSubmit} min` : "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Last external status</dt>
            <dd>{vo.lastExternalStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Last external at</dt>
            <dd>{vo.lastExternalStatusAt ? formatAdminOrderDate(vo.lastExternalStatusAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Awaiting reco / overdue</dt>
            <dd>
              {life.awaitingReconciliation ? "Yes" : "No"} ·{" "}
              {life.overdueReconciliation ? "Overdue" : "Not overdue"} (threshold{" "}
              {DELIVERECT_RECONCILIATION_STALE_MINUTES} min)
            </dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Auto re-check</dt>
            <dd>
              {vo.deliverectAutoRecheckAttemptedAt
                ? `${formatAdminOrderDate(vo.deliverectAutoRecheckAttemptedAt)} · ${vo.deliverectAutoRecheckResult ?? "—"}`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-oo-stone-gray">Provider</dt>
            <dd>{life.routingProviderLabel}</dd>
          </div>
        </dl>

        {showRecheck && (
          <div className="rounded border border-oo-light-stone bg-oo-warm-white p-2">
            <p className="text-[11px] text-oo-stone-gray">
              Channel order id sent to Deliverect = vendor order id{" "}
              <span className="font-mono">{vo.id}</span>
            </p>
            <AdminDeliverectRecheck vendorOrderId={vo.id} onlyIfOverdueDefault={false} />
          </div>
        )}

        <DeliverectPayloadValidationBlock raw={vo.deliverectPayloadValidation} />

        <div className="space-y-2 border-t border-oo-light-stone pt-2">
          <details>
            <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
              Raw: last Deliverect HTTP response
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-oo-light-stone bg-oo-warm-white p-2 font-mono text-[10px] leading-snug">
              {jsonBlock(vo.lastDeliverectResponse, 8000)}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
              Raw: last webhook apply audit
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-oo-light-stone bg-oo-warm-white p-2 font-mono text-[10px] leading-snug">
              {jsonBlock(vo.deliverectWebhookLastApply, 8000)}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
              Raw: last webhook payload
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded border border-oo-light-stone bg-oo-warm-white p-2 font-mono text-[10px] leading-snug">
              {jsonBlock(vo.lastWebhookPayload, 6000)}
            </pre>
          </details>
        </div>

        <p className="text-[11px] text-oo-stone-gray">
          <Link href={`/admin/vendors/${vo.vendorId}/deliverect-mapping`} className="underline">
            Deliverect mapping & integrity
          </Link>
        </p>
      </div>
    </details>
  );
}

/** @deprecated Use AdminVendorOrderOperationalPanel + AdminVendorOrderTechnicalRoutingDetails */
export function AdminDeliverectDiagnosticsPanel({ vo }: { vo: VoRow }) {
  return (
    <>
      <AdminVendorOrderOperationalPanel vo={vo} />
      <AdminVendorOrderTechnicalRoutingDetails vo={vo} />
    </>
  );
}
