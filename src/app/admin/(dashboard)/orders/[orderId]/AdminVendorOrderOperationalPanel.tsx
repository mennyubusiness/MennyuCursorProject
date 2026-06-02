import Link from "next/link";
import {
  buildDeliverectAdminLifecycle,
  getDeliverectAdminActionGuidance,
  shouldShowDeliverectAdminDiagnostics,
  type DeliverectAdminVoInput,
} from "@/lib/deliverect-admin-lifecycle";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { VendorOrderStatusAuthority, VendorOrderStatusSource } from "@prisma/client";
import { formatAdminOrderDate } from "@/lib/admin-order-detail-ui";

type VoRow = AdminOrderDetail["vendorOrders"][number];

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

function lastAttemptAt(vo: VoRow): Date {
  return vo.deliverectSubmittedAt ?? vo.createdAt;
}

/** Default-visible routing/fulfillment summary for a vendor order card. */
export function AdminVendorOrderOperationalPanel({ vo }: { vo: VoRow }) {
  if (!shouldShowDeliverectAdminDiagnostics(vo)) {
    return (
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-oo-stone-gray">Routing</dt>
          <dd className="font-medium capitalize text-oo-charcoal">{vo.routingStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Fulfillment</dt>
          <dd className="font-medium capitalize text-oo-charcoal">{vo.fulfillmentStatus}</dd>
        </div>
        {vo.deliverectAttempts != null && (
          <div>
            <dt className="text-xs text-oo-stone-gray">Routing attempts</dt>
            <dd>{vo.deliverectAttempts}</dd>
          </div>
        )}
      </dl>
    );
  }

  const now = new Date();
  const live = isRoutingRetryAvailable();
  const guidance = getDeliverectAdminActionGuidance(toLifecycleInput(vo), {
    now,
    routingModeDeliverect: live,
  });
  const life = buildDeliverectAdminLifecycle(toLifecycleInput(vo), {
    now,
    routingModeDeliverect: live,
  });

  const showError =
    vo.routingStatus === "failed" &&
    vo.fulfillmentStatus === "pending" &&
    Boolean(vo.deliverectLastError?.trim());

  return (
    <div className="mt-3 space-y-3">
      <div
        className={`rounded-lg border px-3 py-2.5 text-sm ${
          guidance.severity === "urgent"
            ? "border-red-200 bg-red-50/80 text-red-950"
            : guidance.severity === "attention"
              ? "border-amber-200 bg-amber-50/80 text-amber-950"
              : guidance.severity === "success"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                : "border-oo-light-stone bg-oo-cream/50 text-oo-charcoal"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Next step</p>
        <p className="mt-0.5 font-medium">{guidance.recommendedAction}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{guidance.stateSummary}</p>
      </div>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-oo-stone-gray">Routing status</dt>
          <dd className="font-medium capitalize text-oo-charcoal">{vo.routingStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Fulfillment status</dt>
          <dd className="font-medium capitalize text-oo-charcoal">{vo.fulfillmentStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Last attempt</dt>
          <dd>{formatAdminOrderDate(lastAttemptAt(vo))}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Attempt count</dt>
          <dd>{vo.deliverectAttempts ?? 0}</dd>
        </div>
        {vo.manuallyRecoveredAt && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-oo-stone-gray">Manual recovery</dt>
            <dd>{formatAdminOrderDate(vo.manuallyRecoveredAt)}</dd>
          </div>
        )}
        {vo.manualRecoveryNotes?.trim() && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-oo-stone-gray">Recovery note</dt>
            <dd className="rounded border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-sm text-emerald-950">
              {vo.manualRecoveryNotes}
            </dd>
          </div>
        )}
      </dl>

      {showError && (
        <p className="rounded border border-red-200 bg-red-50/70 px-2.5 py-2 text-sm text-red-900">
          <span className="font-medium">Last routing error: </span>
          {vo.deliverectLastError}
        </p>
      )}

      <p className="text-xs text-oo-stone-gray">
        {life.phaseTitle}
        {life.operatorHints.length > 0 && ` · ${life.operatorHints[0]}`}
      </p>
      <p className="text-xs">
        <Link
          href={`/admin/vendors/${vo.vendorId}/deliverect-mapping`}
          className="text-oo-stone-gray underline hover:text-oo-charcoal"
        >
          Menu mapping →
        </Link>
      </p>
    </div>
  );
}
