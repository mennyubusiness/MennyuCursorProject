import type { PodPayoutAllocationSummary } from "@/services/pod-payout-settings.service";
import type { PodPayoutTransferAdminSummary } from "@/services/pod-payout-transfer.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

export type AdminPodDetailLayoutState = {
  hasPayoutIssues: boolean;
  hasTransferablePodPayout: boolean;
  shouldShowFullPayoutDetailsByDefault: boolean;
  shouldShowAllocationTable: boolean;
  shouldShowTransferTable: boolean;
  shouldShowRunPayoutBatch: boolean;
};

export function adminPodReadinessLabel(
  onboardingStatus: string,
  isActive: boolean
): string {
  if (!isActive) return "Inactive";

  switch (onboardingStatus) {
    case "ready_for_next_step":
      return "Ready";
    case "profile_incomplete":
    case "onboarding_in_progress":
    case "account_created":
      return "Setup needed";
    default:
      return "Ready";
  }
}

export function adminPodVendorStatusLabel(input: {
  vendorGloballyActive: boolean;
  podVendorActive: boolean;
}): string {
  if (!input.vendorGloballyActive) return "Paused";
  if (!input.podVendorActive) return "Paused in pod";
  return "Active";
}

export function deriveAdminPodDetailLayout(input: {
  podPayoutsEnabled: boolean;
  podPayoutRecipientUserId: string | null;
  recipientConnectStatus: PodPayoutConnectStatusView | null;
  allocationSummary: PodPayoutAllocationSummary;
  transferSummary: PodPayoutTransferAdminSummary;
  allocationCount: number;
  transferCount: number;
  failedTransferCount: number;
  expandedByDefault?: boolean;
}): AdminPodDetailLayoutState {
  const connectReady = input.recipientConnectStatus?.ready ?? false;
  const hasPayoutConfigIssue =
    input.podPayoutsEnabled &&
    (!input.podPayoutRecipientUserId || (input.podPayoutRecipientUserId != null && !connectReady));

  const hasPayoutIssues =
    input.allocationSummary.blocked.count > 0 ||
    input.allocationSummary.blockedPartialRefundReview.count > 0 ||
    input.transferSummary.blockedTransferCount > 0 ||
    input.failedTransferCount > 0 ||
    hasPayoutConfigIssue;

  const hasTransferablePodPayout =
    input.podPayoutsEnabled &&
    connectReady &&
    input.transferSummary.canRunPayoutBatch;

  const shouldShowFullPayoutDetailsByDefault =
    Boolean(input.expandedByDefault) || hasPayoutIssues;

  return {
    hasPayoutIssues,
    hasTransferablePodPayout,
    shouldShowFullPayoutDetailsByDefault,
    shouldShowAllocationTable: input.allocationCount > 0,
    shouldShowTransferTable: input.transferCount > 0,
    shouldShowRunPayoutBatch: hasTransferablePodPayout,
  };
}
