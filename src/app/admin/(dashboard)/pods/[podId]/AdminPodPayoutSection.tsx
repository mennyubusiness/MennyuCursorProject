"use client";

import { useState } from "react";
import type { AdminPodDetailLayoutState } from "@/lib/admin-pod-detail-layout";
import type {
  PodPayoutAllocationSummary,
  PodPayoutRecipientOption,
} from "@/services/pod-payout-settings.service";
import type {
  PodPayoutTransferAdminRow,
  PodPayoutTransferAdminSummary,
} from "@/services/pod-payout-transfer.service";
import type { AdminPodPayoutAllocationRow } from "@/services/pod-payout-allocation.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";
import { PodPayoutAllocationsCard } from "./PodPayoutAllocationsCard";
import { PodPayoutSettingsCard } from "./PodPayoutSettingsCard";
import { PodPayoutSummaryCard } from "./PodPayoutSummaryCard";
import { PodPayoutTransfersCard } from "./PodPayoutTransfersCard";

export type AdminPodPayoutSectionProps = {
  podId: string;
  layout: AdminPodDetailLayoutState;
  settings: {
    podPayoutsEnabled: boolean;
    podRevenueShareBps: number;
    podPayoutRecipientUserId: string | null;
    minimumPayoutCents: number;
  } | null;
  recipientOptions: PodPayoutRecipientOption[];
  allocationSummary: PodPayoutAllocationSummary;
  recipientConnectStatus: PodPayoutConnectStatusView | null;
  transferSummary: PodPayoutTransferAdminSummary;
  transfers: PodPayoutTransferAdminRow[];
  allocations: AdminPodPayoutAllocationRow[];
};

export function AdminPodPayoutSection({
  podId,
  layout,
  settings,
  recipientOptions,
  allocationSummary,
  recipientConnectStatus,
  transferSummary,
  transfers,
  allocations,
}: AdminPodPayoutSectionProps) {
  const [detailsOpen, setDetailsOpen] = useState(layout.shouldShowFullPayoutDetailsByDefault);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function openDetails() {
    setDetailsOpen(true);
  }

  function openSettings() {
    setDetailsOpen(true);
    setSettingsOpen(true);
  }

  return (
    <div className="space-y-4">
      <PodPayoutSummaryCard
        podId={podId}
        settings={settings}
        allocationSummary={allocationSummary}
        recipientConnectStatus={recipientConnectStatus}
        layout={layout}
        onManageSettings={() => openSettings()}
        onViewDetails={() => openDetails()}
      />

      {detailsOpen ? (
        <div id="payout-details" className="space-y-6 rounded-xl border border-oo-light-stone bg-oo-cream/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-oo-charcoal">Payout details</h2>
            <button
              type="button"
              onClick={() => {
                setDetailsOpen(false);
                setSettingsOpen(false);
              }}
              className="text-sm text-oo-stone-gray underline hover:text-oo-charcoal"
            >
              Hide payout details
            </button>
          </div>

          {settingsOpen || layout.hasPayoutIssues ? (
            <PodPayoutSettingsCard
              podId={podId}
              settings={settings}
              recipientOptions={recipientOptions}
              allocationSummary={allocationSummary}
              recipientConnectStatus={recipientConnectStatus}
              showSettingsForm={settingsOpen || layout.hasPayoutIssues}
            />
          ) : (
            <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
              <p className="text-sm text-oo-stone-gray">
                Allocation and transfer history are below. Use manage payout settings to change pod share,
                minimum payout, or account owner.
              </p>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="mt-3 rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
              >
                Manage payout settings
              </button>
            </div>
          )}

          <PodPayoutAllocationsCard
            podId={podId}
            allocations={allocations}
            showTable={layout.shouldShowAllocationTable}
          />

          <PodPayoutTransfersCard
            podId={podId}
            transferSummary={transferSummary}
            transfers={transfers}
            payoutAccountStatus={recipientConnectStatus}
            showTransferTable={layout.shouldShowTransferTable}
            showRunBatch={layout.shouldShowRunPayoutBatch}
          />
        </div>
      ) : null}
    </div>
  );
}
