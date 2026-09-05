import { describe, expect, it } from "vitest";

import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";
import {
  derivePodReadinessPageSummary,
  deriveVendorMissingLines,
  vendorReadinessBadge,
} from "@/lib/pod-readiness-page";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

function rosterRow(overrides: Partial<PodRosterVendorRow> = {}): PodRosterVendorRow {
  return {
    vendorId: "v1",
    vendorSlug: "vendor-one",
    name: "Vendor One",
    description: null,
    imageUrl: null,
    isFeatured: false,
    podVendorActive: true,
    vendorGloballyActive: true,
    mennyuOrdersPaused: false,
    orderRoutingMode: "manual_dashboard",
    menuOnly: false,
    readiness: {
      status: "needs_hours",
      label: "Needs hours",
      description: "Missing hours",
      canAcceptOrders: false,
      setupSummary: {
        profile: true,
        stripe: true,
        pos: true,
        menu: true,
        hours: false,
      },
      primaryBlocker: {
        code: "hours",
        label: "Customer ordering hours",
        description: "Set customer ordering hours.",
        owner: "vendor",
      },
    },
    ...overrides,
  };
}

describe("derivePodReadinessPageSummary", () => {
  const requiredPodItems: ReadinessChecklistItem[] = [
    { key: "pod_profile", label: "Pod profile complete", complete: true, owner: "pod_owner" },
    { key: "location", label: "Location set", complete: true, owner: "pod_owner" },
    { key: "pod_active", label: "Public page active", complete: true, owner: "open_order" },
    { key: "vendor_ready", label: "At least one orderable vendor", complete: false, owner: "pod_owner" },
  ];

  it("reports vendor attention when a vendor is not orderable", () => {
    const summary = derivePodReadinessPageSummary({
      requiredPodItems,
      rosterRows: [rosterRow()],
    });
    expect(summary.vendorsReadyCount).toBe(0);
    expect(summary.vendorTotalCount).toBe(1);
    expect(summary.headline).toContain("1 vendor needs attention");
  });

  it("reports all ready when pod and vendors are complete", () => {
    const summary = derivePodReadinessPageSummary({
      requiredPodItems: requiredPodItems.map((item) => ({ ...item, complete: true })),
      rosterRows: [rosterRow({ readiness: { ...rosterRow().readiness, canAcceptOrders: true, status: "active" } })],
    });
    expect(summary.allReady).toBe(true);
    expect(summary.headline).toContain("All pod and vendor readiness checks are complete");
  });
});

describe("deriveVendorMissingLines", () => {
  it("uses vendor-owned copy without edit actions", () => {
    const lines = deriveVendorMissingLines(rosterRow());
    expect(lines).toContain("Hidden: customer ordering hours missing.");
  });

  it("shows pod visibility state", () => {
    const lines = deriveVendorMissingLines(rosterRow({ podVendorActive: false }));
    expect(lines).toContain("Not visible on pod page.");
  });
});

describe("vendorReadinessBadge", () => {
  it("labels live vendors", () => {
    expect(
      vendorReadinessBadge(
        rosterRow({
          readiness: {
            ...rosterRow().readiness,
            canAcceptOrders: true,
            status: "active",
            setupSummary: {
              ...rosterRow().readiness.setupSummary,
              hours: true,
              publicProfile: true,
            },
          },
        })
      ).label
    ).toBe("Live");
  });
});
