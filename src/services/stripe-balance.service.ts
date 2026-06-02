import "server-only";

import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export type StripePlatformBalanceSnapshot = {
  availableCents: number;
  pendingCents: number;
  currency: string;
  retrievedAt: string;
};

export type StripePlatformBalanceResult =
  | { ok: true; balance: StripePlatformBalanceSnapshot }
  | { ok: false; error: string };

/**
 * Fetch Stripe platform balance (admin only). Available balance funds Connect transfers.
 */
export async function fetchStripePlatformBalance(
  currency = "usd"
): Promise<StripePlatformBalanceResult> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const balance = await stripe.balance.retrieve();
    const lc = currency.toLowerCase();
    const available = balance.available.find((b) => b.currency === lc);
    const pending = balance.pending.find((b) => b.currency === lc);
    return {
      ok: true,
      balance: {
        availableCents: available?.amount ?? 0,
        pendingCents: pending?.amount ?? 0,
        currency: lc,
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
