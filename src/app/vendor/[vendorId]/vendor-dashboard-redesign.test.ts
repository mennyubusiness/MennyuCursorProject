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

  it("nav prioritizes dashboard, orders, menu tooling, hours, payouts, setup, settings", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toMatch(/dashboard.*Orders.*Hours.*Payouts.*Setup.*Vendor Profile/s);
    expect(nav).toContain("vendorMenuManagementNavLabel");
    expect(nav).toContain("menu/imports");
    expect(nav).not.toContain('"analytics"');
    expect(nav).toContain("Kitchen");
  });

  it("routes vendor root to dashboard", () => {
    const index = readVendor("page.tsx");
    expect(index).toContain("/dashboard");
  });

  it("shows Kitchen mode only in the active orders section, not the page header", () => {
    const page = readVendor("dashboard/page.tsx");
    const active = readVendor("dashboard/VendorDashboardActiveOrdersSection.tsx");
    expect(page).not.toMatch(/actions=\{/);
    expect(page).not.toContain("Kitchen mode");
    expect(active).toContain("Open kitchen mode");
  });
});

describe("vendor operational copy", () => {
  it("avoids technical routing language on dashboard surfaces", () => {
    const store = readVendor("dashboard/VendorStoreStatusCard.tsx");
    expect(store).not.toMatch(/routingStatus|fulfillmentStatus|basis points/i);
    expect(store).not.toContain("VendorOrdersOperationsBar");
    expect(store).toContain("Edit hours");
  });
});

describe("vendor section pages", () => {
  it("defines dedicated manual hours page", () => {
    const hours = readVendor("hours/page.tsx");
    const form = readVendor("hours/VendorCustomerOrderingHoursForm.tsx");
    expect(hours).toContain("VendorCustomerOrderingHoursForm");
    expect(hours).toContain("Set the customer ordering hours for this vendor.");
    expect(hours).not.toContain("VendorStoreStatusCard");
    expect(hours).not.toContain("VendorOrdersOperationsBar");
    expect(form).not.toContain("Sync hours from Deliverect");
    expect(form).not.toContain("Refresh hours from Deliverect");
    expect(form).toContain("Save hours");
  });

  it("defines dedicated payouts and setup pages", () => {
    expect(readVendor("payouts/page.tsx")).toContain("VendorStripePayoutCard");
    expect(readVendor("payouts/page.tsx")).toContain("VendorPayoutTransferHistory");
    const setup = readVendor("setup/page.tsx");
    expect(setup).toContain("VendorSetupChecklist");
    expect(setup).toContain("VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS");
    expect(setup).toContain("VendorSetupStatusBanners");
    expect(setup).toContain("Required to appear on pod page");
    expect(setup).toContain("Required to accept orders");
    expect(setup).not.toContain("Recommended");
    expect(setup).not.toContain("Try Kitchen mode for busy shifts");
    expect(setup).not.toContain("Pickup instructions on pod page");
  });

  it("keeps orders page focused on the workbench", () => {
    const orders = readVendor("orders/page.tsx");
    expect(orders).toContain("VendorOrdersWorkbench");
    expect(orders).not.toContain("VendorOrdersSystemStatusStrip");
    expect(orders).not.toContain("VendorTodayPerformanceSection");
  });
});
