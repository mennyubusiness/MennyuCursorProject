import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import type { VendorAvailabilityInput } from "@/lib/vendor-availability";
import type {
  VendorMenuReadinessSummary,
  VendorPosReadinessSummary,
  VendorReadinessEvaluationInput,
  VendorReadinessVendorFields,
  VendorStripeReadinessSummary,
} from "@/lib/vendor-readiness-states";

const vendorReadinessSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  cuisineCategory: true,
  isActive: true,
  mennyuOrdersPaused: true,
  customerOrderingHours: true,
  stripeConnectedAccountId: true,
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
  deliverectChannelLinkId: true,
  posConnectionStatus: true,
  deliverectAutoMapLastOutcome: true,
  pendingDeliverectConnectionKey: true,
} as const;

export type VendorReadinessBundle = {
  vendor: VendorReadinessVendorFields & { customerOrderingHours: unknown };
  menuSummary: VendorMenuReadinessSummary;
  stripeSummary: VendorStripeReadinessSummary;
  posSummary: VendorPosReadinessSummary;
};

export async function loadVendorReadinessBundles(
  vendorIds: string[]
): Promise<Map<string, VendorReadinessBundle>> {
  const uniqueIds = [...new Set(vendorIds.filter(Boolean))];
  const result = new Map<string, VendorReadinessBundle>();
  if (uniqueIds.length === 0) return result;

  const [vendors, menuSummaries] = await Promise.all([
    prisma.vendor.findMany({ where: { id: { in: uniqueIds } }, select: vendorReadinessSelect }),
    loadVendorMenuReadinessSummaries(uniqueIds),
  ]);

  const stripeConnectConfigured = Boolean(env.STRIPE_SECRET_KEY);

  for (const vendor of vendors) {
    result.set(vendor.id, {
      vendor: {
        isActive: vendor.isActive,
        mennyuOrdersPaused: vendor.mennyuOrdersPaused ?? false,
        name: vendor.name,
        slug: vendor.slug,
        description: vendor.description,
        imageUrl: vendor.imageUrl,
        cuisineCategory: vendor.cuisineCategory,
        customerOrderingHours: vendor.customerOrderingHours,
      },
      menuSummary: menuSummaries.get(vendor.id) ?? {
        hasPublishedMenuVersion: false,
        hasOperationalItems: false,
        hasAvailableOperationalItems: false,
      },
      stripeSummary: {
        stripeConnectedAccountId: vendor.stripeConnectedAccountId,
        stripeChargesEnabled: vendor.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: vendor.stripePayoutsEnabled ?? false,
        stripeConnectConfigured,
      },
      posSummary: {
        deliverectChannelLinkId: vendor.deliverectChannelLinkId,
        posConnectionStatus: vendor.posConnectionStatus,
        deliverectAutoMapLastOutcome: vendor.deliverectAutoMapLastOutcome,
        pendingDeliverectConnectionKey: vendor.pendingDeliverectConnectionKey,
        hasUnmatchedChannelRegistration: false,
      },
    });
  }

  return result;
}

export function buildVendorReadinessEvaluationInput(
  bundle: VendorReadinessBundle,
  input: {
    pod: { isActive: boolean; mennyuOrdersPaused?: boolean };
    podVendor: { exists: boolean; isActive: boolean };
    vendorAvailability?: VendorAvailabilityInput;
  }
): VendorReadinessEvaluationInput {
  return {
    vendor: bundle.vendor,
    menuSummary: bundle.menuSummary,
    stripeSummary: bundle.stripeSummary,
    posSummary: bundle.posSummary,
    pod: input.pod,
    podVendor: input.podVendor,
    vendorAvailability: input.vendorAvailability,
  };
}
