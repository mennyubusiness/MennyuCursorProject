/**
 * Stripe platform payout config safe for client components (no env access).
 */

/** Default $2,500 — higher than legacy $500 dashboard minimum to reduce vendor transfer starvation. */
export const DEFAULT_STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS = 250_000;

export function formatRecommendedPlatformMinimumBalanceLabel(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export const ADMIN_STRIPE_PLATFORM_MINIMUM_BALANCE_INSTRUCTION =
  "In Stripe Dashboard → Settings → Payouts → Minimum balance, set the platform minimum balance to at least the recommended amount below. This helps keep enough available balance for vendor Connect transfers that cannot use source_transaction.";

export const ADMIN_VENDOR_AUTO_TRANSFER_WARNING =
  "Vendor transfers should be sent automatically after payment. If Open Order's platform payout drains available balance before transfers are sent, transfers without source_transaction can fail.";

export const ADMIN_VENDOR_TRANSFER_VS_PLATFORM_PAYOUT =
  "Vendor Connect transfers move money Open Order owes vendors to their connected accounts. Platform payouts move Stripe's remaining balance to Open Order's bank account — they are separate.";
