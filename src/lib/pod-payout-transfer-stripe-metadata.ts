/**
 * Stripe Connect transfer metadata / transfer_group for pod payout rows.
 */

export type PodPayoutTransferStripeContext = {
  id: string;
  podPayoutAllocationId: string;
  podId: string;
  orderId: string;
  paymentId: string;
  recipientUserId: string;
};

export function buildPodPayoutTransferStripeMetadata(
  row: PodPayoutTransferStripeContext
): Record<string, string> {
  return {
    openOrderPodPayoutTransferId: row.id,
    podPayoutAllocationId: row.podPayoutAllocationId,
    podId: row.podId,
    orderId: row.orderId,
    paymentId: row.paymentId,
    recipientUserId: row.recipientUserId,
    openOrderPurpose: "pod_payout",
    platform: "open_order",
    mennyu_pod_payout_transfer_id: row.id,
    mennyu_pod_payout_allocation_id: row.podPayoutAllocationId,
    mennyu_user_id: row.recipientUserId,
    mennyu_connect_purpose: "pod_payout",
  };
}

export function buildPodPayoutTransferGroup(orderId: string): string {
  return `order_${orderId}`;
}
