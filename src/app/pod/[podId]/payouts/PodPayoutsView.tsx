import { DashboardCard } from "@/components/dashboard";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";
import type { PodOwnerPayoutSummary } from "@/services/pod-payout-summary.service";
import { PodPayoutSetupCard } from "../settings/PodPayoutSetupCard";
import { PodPayoutEarningsSummary } from "./PodPayoutEarningsSummary";
import { PodPayoutHistorySection } from "./PodPayoutHistorySection";

type PodPayoutsViewProps = {
  podId: string;
  summary: PodOwnerPayoutSummary | null;
  podPayoutsEnabled: boolean;
  isDesignatedRecipient: boolean;
  stripeConnectConfigured: boolean;
  connectStatus: PodPayoutConnectStatusView | null;
  payoutNotice: "link_expired" | null;
};

export function PodPayoutsView({
  podId,
  summary,
  podPayoutsEnabled,
  isDesignatedRecipient,
  stripeConnectConfigured,
  connectStatus,
  payoutNotice,
}: PodPayoutsViewProps) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-6 text-sm text-oo-stone-gray">
        Pod payout details are available to the payout account owner for this pod.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PodPayoutEarningsSummary summary={summary} />

      <PodPayoutHistorySection enabled={summary.enabled} payoutHistory={summary.payoutHistory} />

      <DashboardCard
        title="Payout settings"
        description="Manage the account and details used for your pod share."
        as="section"
      >
        <PodPayoutSetupCard
          podId={podId}
          embedded
          podPayoutsEnabled={podPayoutsEnabled}
          isDesignatedRecipient={isDesignatedRecipient}
          stripeConnectConfigured={stripeConnectConfigured}
          connectStatus={connectStatus}
          payoutNotice={payoutNotice}
          podSharePercentLabel={summary.podSharePercentLabel}
          minimumPayoutLabel={summary.minimumPayoutLabel}
          payoutAccountStatusLabel={connectStatus?.ownerLabel ?? summary.payoutSetupStatus}
          payoutSetupReady={summary.payoutSetupReady}
        />
      </DashboardCard>
    </div>
  );
}
