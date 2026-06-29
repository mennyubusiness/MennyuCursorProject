import "server-only";

import type { VendorOrderRoutingMode } from "@prisma/client";
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
  orderRoutingMode: true,
} as const;

export type VendorReadinessBundle = {
  vendor: VendorReadinessVendorFields & { customerOrderingHours: unknown };
  menuSummary: VendorMenuReadinessSummary;
  stripeSummary: VendorStripeReadinessSummary;
  posSummary: VendorPosReadinessSummary;
};

export type LoadVendorReadinessBundlesOptions = {
  /**
   * When true, runs Deliverect menu integrity for deliverect-routing vendors.
   * Keep false for public pod/menu surfaces; enable for checkout/cart/admin validation.
   */
  includeDeliverectMappingIntegrity?: boolean;
};

export async function loadVendorReadinessBundles(
  vendorIds: string[],
  options: LoadVendorReadinessBundlesOptions = {}
): Promise<Map<string, VendorReadinessBundle>> {
  const uniqueIds = [...new Set(vendorIds.filter(Boolean))];
  const result = new Map<string, VendorReadinessBundle>();
  if (uniqueIds.length === 0) return result;

  const [vendors, menuSummaries] = await Promise.all([
    prisma.vendor.findMany({ where: { id: { in: uniqueIds } }, select: vendorReadinessSelect }),
    loadVendorMenuReadinessSummaries(uniqueIds),
  ]);

  const routingModes = new Map<string, VendorOrderRoutingMode>(
    vendors.map((vendor) => [vendor.id, vendor.orderRoutingMode])
  );

  let mappingReadyByVendor = new Map<string, boolean>();
  if (options.includeDeliverectMappingIntegrity) {
    const { loadVendorDeliverectMappingReadyMap } = await import(
      "@/services/vendor-deliverect-mapping-readiness.server"
    );
    mappingReadyByVendor = await loadVendorDeliverectMappingReadyMap(uniqueIds, routingModes);
  }

  const stripeConnectConfigured = Boolean(env.STRIPE_SECRET_KEY);

  for (const vendor of vendors) {
    const deliverectMappingReady = options.includeDeliverectMappingIntegrity
      ? (mappingReadyByVendor.get(vendor.id) ?? true)
      : undefined;

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
        orderRoutingMode: vendor.orderRoutingMode,
        deliverectMappingReady,
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
