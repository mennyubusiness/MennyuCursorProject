/** Plain-English vendor payout transfer labels. */

export function vendorPayoutTransferStatusLabel(status: string, blockedReason?: string | null): string {
  const reason = blockedReason?.toLowerCase() ?? "";
  if (reason.includes("refund")) {
    if (status === "blocked") return "Blocked because of refund";
    if (status === "failed") return "Cancelled because of refund";
  }
  switch (status) {
    case "pending":
      return "Pending";
    case "submitted":
      return "Sent";
    case "paid":
      return "Paid";
    case "blocked":
      return "Needs review";
    case "failed":
      return "Needs review";
    default:
      return "Pending";
  }
}

export function vendorStripeConnectionLabel(input: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  hasAccount: boolean;
  requirementsPending: boolean;
}): string {
  if (input.chargesEnabled && input.payoutsEnabled) return "Stripe connected";
  if (input.hasAccount && input.requirementsPending) return "Stripe needs attention";
  if (input.hasAccount) return "Stripe setup incomplete";
  return "Stripe not connected";
}
