import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(process.cwd(), "src");

function readVendor(relativePath: string): string {
  return readFileSync(join(vendorDir, relativePath), "utf8");
}

describe("vendor orders command center layout", () => {
  it("uses DashboardShell command tier on the orders page", () => {
    const page = readVendor("orders/page.tsx");
    const styles = readFileSync(join(root, "components/dashboard/dashboard-styles.ts"), "utf8");

    expect(page).toContain('tier="command"');
    expect(page).toContain("DashboardShell");
    expect(page).not.toContain("max-w-2xl");
    expect(styles).toContain("max-w-7xl");
  });

  it("uses shared DashboardPageHeader with vendor-facing copy", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain('title="Orders"');
    expect(page).toContain("eyebrow={vendor.name}");
    expect(page).toContain("Manage incoming orders, kitchen status, and customer pickup flow");
    expect(page).toContain("Kitchen Mode");
  });

  it("organizes live orders, system status, and operations sections", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain("DashboardSection");
    expect(page).toContain("Live orders");
    expect(page).toContain("VendorDashboardLiveOrders");
    expect(page).toContain("VendorOrdersSystemStatusStrip");
    expect(page).toContain("VendorOrdersOperationsBar");
    expect(page).toContain("DashboardCard");
  });

  it("uses responsive two-column layout on large screens", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toMatch(/lg:grid-cols-/);
  });
});

describe("vendor orders empty state", () => {
  it("uses DashboardEmptyState copy for no active orders", () => {
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    expect(live).toContain("DashboardEmptyState");
    expect(live).toContain("No active orders right now.");
    expect(live).toContain("New orders will appear here when customers place them.");
  });
});

describe("vendor area nav width", () => {
  it("supports wide nav aligned to max-w-7xl", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toContain("wide");
    expect(nav).toContain("max-w-7xl");
    expect(nav).toContain("max-w-2xl");
  });

  it("enables wide chrome for orders, menu, settings, and menu-imports", () => {
    const chrome = readVendor("VendorLayoutChrome.tsx");
    expect(chrome).toContain("/orders");
    expect(chrome).toContain("/menu");
    expect(chrome).toContain("/settings");
    expect(chrome).toContain("/menu-imports");
    expect(chrome).toContain("wide={isWideWorkspace}");
  });

  it("keeps kitchen mode outside dashboard chrome", () => {
    const chrome = readVendor("VendorLayoutChrome.tsx");
    expect(chrome).toMatch(/if \(isKitchen\)[\s\S]*min-h-dvh/);
    const kitchenBranch = chrome.split("if (isKitchen)")[1]?.split("const headerWidth")[0] ?? "";
    expect(kitchenBranch).not.toContain("oo-dash-titlebar");
    expect(kitchenBranch).not.toContain("VendorAreaNav");
  });
});

describe("vendor orders preserved behavior", () => {
  it("still wires live orders polling and operations controls", () => {
    const page = readVendor("orders/page.tsx");
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    const ops = readVendor("dashboard/VendorOrdersOperationsBar.tsx");

    expect(page).toContain("getVendorOrdersBoardData");
    expect(page).toContain("serializeVendorOrdersForBoard");
    expect(live).toContain("useVendorOrdersPoll");
    expect(live).toContain("VendorOrderCard");
    expect(ops).toContain("/api/vendor/");
    expect(ops).toContain("pause");
  });

  it("keeps system status links to vendor settings sections", () => {
    const strip = readVendor("dashboard/VendorOrdersSystemStatusStrip.tsx");
    expect(strip).toContain("vendorSettingsSectionHref");
    expect(strip).toContain("pos-menu");
    expect(strip).toContain("ordering");
  });
});

describe("vendor orders copy guardrails", () => {
  it("does not add payout or earnings language to orders surfaces", () => {
    const page = readVendor("orders/page.tsx");
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    const strip = readVendor("dashboard/VendorOrdersSystemStatusStrip.tsx");
    const banner = readVendor("dashboard/VendorOrdersSetupBanner.tsx");

    expect(page).not.toMatch(/\bearnings\b|\brevenue share\b/i);
    expect(live).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayouts?\b/i);
    expect(strip).not.toMatch(/\bearnings\b|\brevenue share\b/i);
    expect(strip).toContain("Payments");
    expect(strip).not.toMatch(/>Payouts</);
    expect(banner).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayouts?\b/i);
  });

  it("does not use pod-owner language on vendor orders", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).not.toMatch(/your pod|public pod page|vendor adoption/i);
  });

  it("uses vendor-facing readiness labels in the status strip", () => {
    const strip = readVendor("dashboard/VendorOrdersSystemStatusStrip.tsx");
    expect(strip).toContain("Ready for orders");
    expect(strip).toContain("DashboardStatusBadge");
    expect(strip).toContain("Payments");
  });
});
