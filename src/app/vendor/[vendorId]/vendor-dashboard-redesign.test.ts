import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorDir = dirname(fileURLToPath(import.meta.url));

function readVendor(relativePath: string): string {
  return readFileSync(join(vendorDir, relativePath), "utf8");
}

describe("vendor dashboard operating layout", () => {
  it("uses a real dashboard page with store status first", () => {
    const page = readVendor("dashboard/page.tsx");
    expect(page).toContain("VendorStoreStatusCard");
    expect(page).toContain("VendorDashboardActiveOrdersSection");
    expect(page).toContain("VendorNeedsAttentionSection");
    expect(page).toContain("VendorTodayPerformanceSection");
    expect(page).not.toContain('redirect(`/vendor/${vendorId}/orders`)');
  });

  it("nav prioritizes dashboard, orders, menu, hours, payouts, settings", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toMatch(/dashboard.*Orders.*Menu.*Hours.*Payouts.*Settings/s);
    expect(nav).not.toContain('"analytics"');
    expect(nav).toContain("Kitchen");
  });

  it("routes vendor root to dashboard", () => {
    const index = readVendor("page.tsx");
    expect(index).toContain("/dashboard");
  });
});

describe("vendor operational copy", () => {
  it("avoids technical routing language on dashboard surfaces", () => {
    const store = readVendor("dashboard/VendorStoreStatusCard.tsx");
    const ops = readVendor("dashboard/VendorOrdersOperationsBar.tsx");
    expect(store).not.toMatch(/routingStatus|fulfillmentStatus|basis points/i);
    expect(ops).toContain("Pause orders");
    expect(ops).toContain("VENDOR_POS_MANAGED_COPY");
  });
});

describe("vendor section pages", () => {
  it("defines dedicated hours, payouts, and setup pages", () => {
    expect(readVendor("hours/page.tsx")).toContain("VendorOrdersOperationsBar");
    expect(readVendor("payouts/page.tsx")).toContain("VendorStripePayoutCard");
    expect(readVendor("setup/page.tsx")).toContain("VendorSetupChecklist");
  });

  it("keeps orders page focused on the live board", () => {
    const orders = readVendor("orders/page.tsx");
    expect(orders).toContain("VendorDashboardLiveOrders");
    expect(orders).not.toContain("VendorOrdersSystemStatusStrip");
    expect(orders).not.toContain("VendorTodayPerformanceSection");
  });
});
