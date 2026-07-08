import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFindMany = vi.fn();
const mockMenuSummaries = vi.fn();
const mockSquareHealth = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findMany: (...args: unknown[]) => mockVendorFindMany(...args),
    },
  },
}));

vi.mock("@/lib/vendor-menu-readiness.server", () => ({
  loadVendorMenuReadinessSummaries: (...args: unknown[]) => mockMenuSummaries(...args),
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  evaluateSquareConnectionHealth: (...args: unknown[]) => mockSquareHealth(...args),
}));

import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import { defaultVendorCustomerOrderingWeek } from "@/lib/vendor-customer-ordering-hours";

describe("loadVendorReadinessBundles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMenuSummaries.mockResolvedValue(
      new Map([
        [
          "vendor_sq",
          {
            hasPublishedMenuVersion: true,
            hasOperationalItems: true,
            hasAvailableOperationalItems: true,
          },
        ],
      ])
    );
    mockSquareHealth.mockResolvedValue({ isReady: true });
  });

  it("includes squareConnectionReady for square routing vendors", async () => {
    mockVendorFindMany.mockResolvedValue([
      {
        id: "vendor_sq",
        name: "Poke Sea",
        slug: "poke-sea",
        description: "Fresh poke",
        imageUrl: "https://example.com/banner.jpg",
        cuisineCategory: "Seafood",
        isActive: true,
        mennyuOrdersPaused: false,
        customerOrderingHours: [],
        stripeConnectedAccountId: "acct_1",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
        deliverectAutoMapLastOutcome: null,
        pendingDeliverectConnectionKey: null,
        orderRoutingMode: "square",
        menuSource: "open_order",
      },
    ]);

    const bundles = await loadVendorReadinessBundles(["vendor_sq"]);
    const bundle = bundles.get("vendor_sq");
    expect(bundle?.posSummary.squareConnectionReady).toBe(true);
    expect(mockSquareHealth).toHaveBeenCalledWith("vendor_sq");
  });

  it("powers public orderability for connected square vendors without admin injection", async () => {
    mockVendorFindMany.mockResolvedValue([
      {
        id: "vendor_sq",
        name: "Poke Sea",
        slug: "poke-sea",
        description: "Fresh poke",
        imageUrl: "https://example.com/banner.jpg",
        cuisineCategory: "Seafood",
        isActive: true,
        mennyuOrdersPaused: false,
        customerOrderingHours: defaultVendorCustomerOrderingWeek(),
        stripeConnectedAccountId: "acct_1",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        deliverectChannelLinkId: null,
        posConnectionStatus: "not_connected",
        deliverectAutoMapLastOutcome: null,
        pendingDeliverectConnectionKey: null,
        orderRoutingMode: "square",
        menuSource: "open_order",
      },
    ]);

    const bundles = await loadVendorReadinessBundles(["vendor_sq"]);
    const bundle = bundles.get("vendor_sq");
    expect(bundle).toBeTruthy();

    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true },
      readiness: {
        vendor: bundle!.vendor,
        menuSummary: bundle!.menuSummary,
        stripeSummary: { ...bundle!.stripeSummary, stripeConnectConfigured: true },
        posSummary: bundle!.posSummary,
      },
    });

    expect(result.orderable).toBe(true);
  });
});
