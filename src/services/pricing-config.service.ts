/**
 * Active global `PricingConfig` for checkout and order creation.
 */
import { prisma } from "@/lib/db";
import {
  DEFAULT_LEGACY_PRICING_RATES,
  type PricingRatesSnapshot,
} from "@/domain/pricing-engine";

export async function getActivePricingRatesSnapshot(): Promise<{
  pricingConfigId: string | null;
  rates: PricingRatesSnapshot;
}> {
  const row = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
  if (!row) {
    console.warn("[pricing] No active PricingConfig — using DEFAULT_LEGACY_PRICING_RATES");
    return { pricingConfigId: null, rates: DEFAULT_LEGACY_PRICING_RATES };
  }
  return {
    pricingConfigId: row.id,
    rates: {
      customerServiceFeeBps: row.customerServiceFeeBps,
      customerServiceFeeFlatCents: row.customerServiceFeeFlatCents,
      vendorProcessingFeeBps: row.vendorProcessingFeeBps,
      vendorProcessingFeeFlatCents: row.vendorProcessingFeeFlatCents,
    },
  };
}

export async function getActivePricingConfigRow() {
  return prisma.pricingConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
}
