import Link from "next/link";

import { DashboardEmptyState, DashboardSection } from "@/components/dashboard";
import { KITCHEN_COLUMN_LABELS } from "@/lib/vendor-orders-board";
import { VENDOR_NO_ACTIVE_ORDERS_COPY, VENDOR_POS_BOARD_READONLY_COPY } from "@/lib/vendor-operational-copy";
import { VendorDashboardLiveOrders } from "./VendorDashboardLiveOrders";

type ActiveCounts = {
  new: number;
  preparing: number;
  ready: number;
};

export function VendorDashboardActiveOrdersSection({
  vendorId,
  vendorDeliverectChannelLinkId,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive,
  posManaged,
  activeCounts,
}: {
  vendorId: string;
  vendorDeliverectChannelLinkId: string | null;
  initialVendorOrders: Parameters<typeof VendorDashboardLiveOrders>[0]["initialVendorOrders"];
  initialNowMs: number;
  isDeliverectLive: boolean;
  posManaged: boolean;
  activeCounts: ActiveCounts;
}) {
  const totalActive = activeCounts.new + activeCounts.preparing + activeCounts.ready;

  return (
    <DashboardSection
      title="Active orders"
      description="New, preparing, and ready for pickup."
      className="min-w-0"
      contentClassName="space-y-4"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/vendor/${vendorId}/kitchen`}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Open kitchen mode
          </Link>
          <Link
            href={`/vendor/${vendorId}/orders`}
            className="inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            View all orders
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(KITCHEN_COLUMN_LABELS) as Array<keyof typeof KITCHEN_COLUMN_LABELS>).map((key) => (
          <div key={key} className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-3 py-3 text-center">
            <p className="text-xs font-medium text-oo-stone-gray">{KITCHEN_COLUMN_LABELS[key]}</p>
            <p className="mt-1 text-2xl font-bold text-oo-charcoal">{activeCounts[key]}</p>
          </div>
        ))}
      </div>

      {posManaged ? (
        <p className="rounded-lg bg-oo-cream/80 px-3 py-2 text-sm text-oo-stone-gray">
          {VENDOR_POS_BOARD_READONLY_COPY}
        </p>
      ) : null}

      {totalActive === 0 ? (
        <DashboardEmptyState
          title={VENDOR_NO_ACTIVE_ORDERS_COPY}
          description="New orders will show up here and on the Orders page."
        />
      ) : (
        <VendorDashboardLiveOrders
          vendorId={vendorId}
          vendorDeliverectChannelLinkId={vendorDeliverectChannelLinkId}
          initialVendorOrders={initialVendorOrders}
          initialNowMs={initialNowMs}
          isDeliverectLive={isDeliverectLive}
          activeGroupsOnly
        />
      )}
    </DashboardSection>
  );
}
