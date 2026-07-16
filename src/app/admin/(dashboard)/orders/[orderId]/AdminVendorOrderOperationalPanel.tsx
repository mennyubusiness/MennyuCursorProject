import {
  fulfillmentStatusBadge,
  providerLabel,
} from "@/lib/admin-order-detail-ui";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { AdminVendorOrderSummary } from "@/lib/admin-order-operational-summary";
import { getKitchenActionPolicy } from "@/lib/order-routing/kitchen-action-policy";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { isSquareWebhookSignatureConfigured } from "@/lib/integrations/square/square-webhook-verify";

type VoRow = AdminOrderDetail["vendorOrders"][number];

/** Plain-language vendor status for the default card view. */
export function AdminVendorOrderOperationalPanel({
  vo,
  vendorSummary,
}: {
  vo: VoRow;
  vendorSummary?: AdminVendorOrderSummary | null;
}) {
  const fulfillment = fulfillmentStatusBadge(vo.fulfillmentStatus);
  const provider = providerLabel(vo);
  const kitchenPolicy = getKitchenActionPolicy(
    {
      orderRoutingMode: vo.vendor.orderRoutingMode,
      deliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
    },
    {
      routingStatus: vo.routingStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      squareOrderId: vo.squareOrderId,
      deliverectOrderId: vo.deliverectOrderId,
      manuallyRecoveredAt: vo.manuallyRecoveredAt,
      statusAuthority: vo.statusAuthority,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendor: vo.vendor,
    },
    {
      squareStatusSyncConfigured: isSquareWebhookSignatureConfigured(),
      deliverectRoutingLive: isRoutingRetryAvailable(),
    }
  );

  const statusLabel = vendorSummary?.statusLabel ?? fulfillment.label;
  const statusDetail = vendorSummary?.statusDetail;
  const received = vendorSummary?.receivedLabel ?? "Unknown";
  const recovered = vendorSummary?.recoveryState === "recovered_manually";
  const activeRoutingFailure = vendorSummary?.statusKey === "routing_failed";

  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <p className="font-medium text-oo-charcoal">{statusLabel}</p>
        {statusDetail ? <p className="mt-0.5 text-xs text-oo-stone-gray">{statusDetail}</p> : null}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-oo-stone-gray">Vendor received order</dt>
          <dd className="mt-0.5 text-oo-charcoal">{received}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-oo-stone-gray">Order management</dt>
          <dd className="mt-0.5 text-oo-charcoal">{vendorSummary?.fulfillmentLabel ?? fulfillment.label}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-oo-stone-gray">Payment allocation</dt>
          <dd className="mt-0.5 text-oo-charcoal">{vendorSummary?.paymentAllocationLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-oo-stone-gray">Routing provider</dt>
          <dd className="mt-0.5 text-oo-stone-gray">
            {provider.label === "Square"
              ? "Square"
              : provider.label === "Deliverect"
                ? "Deliverect"
                : "Open Order"}
          </dd>
        </div>
      </dl>

      {kitchenPolicy.showProviderManagedState && kitchenPolicy.managedOrderBadge && !recovered ? (
        <p className="text-xs text-oo-stone-gray">
          <span className="font-medium text-oo-charcoal">{kitchenPolicy.managedOrderBadge}</span>
          {kitchenPolicy.statusSyncCopy ? ` — ${kitchenPolicy.statusSyncCopy}` : null}
        </p>
      ) : null}

      {activeRoutingFailure && kitchenPolicy.recoveryCopy ? (
        <p className="rounded border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-xs text-amber-950">
          {kitchenPolicy.recoveryCopy}
        </p>
      ) : null}

      {activeRoutingFailure && (vo.squareLastError || vo.deliverectLastError) ? (
        <p className="rounded border border-red-200 bg-red-50/70 px-2.5 py-2 text-xs text-red-900">
          Routing problem: {(vo.squareLastError ?? vo.deliverectLastError ?? "").slice(0, 160)}
          {(vo.squareLastError ?? vo.deliverectLastError ?? "").length > 160 ? "…" : ""}
        </p>
      ) : null}

      {vendorSummary?.historicalRoutingFailure ? (
        <details className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-oo-charcoal">
            View resolved routing issue
          </summary>
          <dl className="mt-2 space-y-1.5 text-xs text-oo-stone-gray">
            <div>
              <dt className="font-medium text-oo-charcoal">Provider</dt>
              <dd>{vendorSummary.historicalRoutingFailure.provider}</dd>
            </div>
            {vendorSummary.historicalRoutingFailure.message ? (
              <div>
                <dt className="font-medium text-oo-charcoal">Original error</dt>
                <dd className="whitespace-pre-wrap">{vendorSummary.historicalRoutingFailure.message}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-oo-charcoal">Recovery</dt>
              <dd>
                Manual recovery
                {vendorSummary.historicalRoutingFailure.recoveredAt
                  ? ` · ${new Date(vendorSummary.historicalRoutingFailure.recoveredAt).toLocaleString()}`
                  : ""}
                {vendorSummary.historicalRoutingFailure.recoveredBy
                  ? ` · ${vendorSummary.historicalRoutingFailure.recoveredBy}`
                  : ""}
              </dd>
            </div>
            {vendorSummary.historicalRoutingFailure.recoveryNotes ? (
              <div>
                <dt className="font-medium text-oo-charcoal">Recovery note</dt>
                <dd>{vendorSummary.historicalRoutingFailure.recoveryNotes}</dd>
              </div>
            ) : null}
            {vo.squareOrderId?.trim() ? (
              <div>
                <dt className="font-medium text-oo-charcoal">Square order ID</dt>
                <dd className="break-all font-mono">{vo.squareOrderId}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
