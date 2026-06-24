/**
 * Stripe platform payout configuration (server-only env access).
 */
import "server-only";

import { env } from "@/lib/env";
import { DEFAULT_STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS } from "@/lib/stripe-platform-payout-config.shared";

export function getStripeRecommendedPlatformMinimumBalanceCents(): number {
  const raw = env.STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS?.trim();
  if (!raw) return DEFAULT_STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS;
  }
  return parsed;
}
