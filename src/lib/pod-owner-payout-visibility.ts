/**
 * Pod owner dashboard: payouts UI is shown only after an admin configures pod payout settings.
 */
export function arePodOwnerPayoutsConfigured(input: {
  podPayoutsEnabled: boolean;
}): boolean {
  return input.podPayoutsEnabled;
}
