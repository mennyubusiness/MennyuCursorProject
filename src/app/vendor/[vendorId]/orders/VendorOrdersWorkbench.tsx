"use client";

import Link from "next/link";
import { useState } from "react";

import { DashboardSection } from "@/components/dashboard";
import { VENDOR_POS_BOARD_READONLY_COPY } from "@/lib/vendor-operational-copy";
import { VendorKitchenPauseToggle } from "../kitchen/VendorKitchenPauseToggle";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";
import { VendorOrdersHistorySection } from "./VendorOrdersHistorySection";

type WorkbenchOrder = Parameters<typeof VendorDashboardLiveOrders>[0]["initialVendorOrders"][number];

type Tab = "active" | "history";

export function VendorOrdersWorkbench({
  vendorId,
  vendorName,
  vendorDeliverectChannelLinkId,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive,
  orderRoutingMode,
  posManaged,
  initialPaused,
}: {
  vendorId: string;
  vendorName: string;
  vendorDeliverectChannelLinkId: string | null;
  initialVendorOrders: WorkbenchOrder[];
  initialNowMs: number;
  isDeliverectLive: boolean;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  posManaged: boolean;
  initialPaused: boolean;
}) {
  const [tab, setTab] = useState<Tab>("active");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-oo-light-stone bg-oo-cream/50 p-1">
          {(
            [
              ["active", "Active orders"],
              ["history", "History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === id ? "bg-oo-warm-white text-oo-charcoal shadow-sm" : "text-oo-stone-gray hover:text-oo-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/vendor/${vendorId}/kitchen`}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
          >
            Kitchen mode
          </Link>
          <VendorKitchenPauseToggle
            vendorId={vendorId}
            initialPaused={initialPaused}
            variant="orders"
            posManaged={posManaged}
          />
        </div>
      </div>

      {posManaged ? (
        <p className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-4 py-3 text-sm text-oo-stone-gray">
          {VENDOR_POS_BOARD_READONLY_COPY}
        </p>
      ) : null}

      {tab === "active" ? (
        <DashboardSection
          title="Active orders"
          description={`Live board for ${vendorName} — New, Preparing, and Ready for pickup.`}
          className="min-w-0"
          contentClassName="space-y-0"
          showHeader={false}
        >
          <VendorDashboardLiveOrders
            vendorId={vendorId}
            vendorDeliverectChannelLinkId={vendorDeliverectChannelLinkId}
            initialVendorOrders={initialVendorOrders}
            initialNowMs={initialNowMs}
            isDeliverectLive={isDeliverectLive}
            orderRoutingMode={orderRoutingMode}
            activeGroupsOnly
          />
        </DashboardSection>
      ) : (
        <VendorOrdersHistorySection
          orders={initialVendorOrders}
          initialNowMs={initialNowMs}
          isDeliverectLive={isDeliverectLive}
          posManaged={posManaged}
        />
      )}

      <p className="text-sm text-oo-stone-gray">
        Open order issues on the{" "}
        <Link href={`/vendor/${vendorId}/issues`} className="font-medium text-oo-charcoal underline">
          Issues
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
