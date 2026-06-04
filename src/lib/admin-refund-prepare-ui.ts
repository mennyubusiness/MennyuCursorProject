import type { PrepareMissingReversalBlockReason } from "@/lib/admin-refund-evidence";
import { prepareMissingReversalBlockMessage } from "@/lib/admin-refund-evidence";

export function formatPrepareMissingReversalError(
  reason: string | PrepareMissingReversalBlockReason
): string {
  const known: PrepareMissingReversalBlockReason[] = [
    "missing_safe_refund_link",
    "no_succeeded_order_refund",
    "no_succeeded_refund_attempt",
    "refund_ledger_missing",
    "refund_is_legacy_or_denormalized_only",
    "partial_refund_manual_review",
    "transfer_not_paid_via_connect",
    "unsafe_reversal_amount",
    "vendor_payout_transfer_not_found_for_order",
    "duplicate_existing_reversal",
  ];
  if (known.includes(reason as PrepareMissingReversalBlockReason)) {
    return prepareMissingReversalBlockMessage(reason as PrepareMissingReversalBlockReason);
  }
  return prepareMissingReversalBlockMessage("no_succeeded_order_refund");
}
