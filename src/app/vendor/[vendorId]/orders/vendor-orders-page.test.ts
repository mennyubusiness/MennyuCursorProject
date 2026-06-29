import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function readVendor(relativePath: string): string {
  return readFileSync(join(vendorDir, relativePath), "utf8");
}

describe("vendor orders workbench layout", () => {
  it("uses DashboardShell command tier on the orders page", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain('tier="command"');
    expect(page).toContain("DashboardShell");
  });

  it("uses shared DashboardPageHeader with vendor-facing copy", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain('title="Orders"');
    expect(page).toContain("operational workbench");
  });

  it("routes orders through VendorOrdersWorkbench with active/history tabs", () => {
    const page = readVendor("orders/page.tsx");
    const workbench = readVendor("orders/VendorOrdersWorkbench.tsx");
    expect(page).toContain("VendorOrdersWorkbench");
    expect(workbench).toContain("VendorDashboardLiveOrders");
    expect(workbench).toContain("VendorOrdersHistorySection");
    expect(workbench).toContain("Kitchen mode");
    expect(workbench).toContain("VendorKitchenPauseToggle");
    expect(workbench).toContain('variant="orders"');
    expect(page).not.toContain("VendorOrdersSystemStatusStrip");
    expect(page).not.toContain("VendorOrdersOperationsBar");
  });
});

describe("vendor orders empty state", () => {
  it("uses DashboardEmptyState copy for no active orders", () => {
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    expect(live).toContain("DashboardEmptyState");
    expect(live).toContain("No active orders right now.");
    expect(live).toContain("showActiveEmpty");
  });
});

describe("vendor area nav width", () => {
  it("supports wide nav aligned to max-w-7xl", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toContain("wide");
    expect(nav).toContain("max-w-7xl");
  });

  it("includes setup in primary nav", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).toContain('"setup"');
    expect(nav).toMatch(/dashboard.*Orders.*Menu.*Hours.*Payouts.*Setup.*Vendor Profile/s);
  });

  it("enables wide chrome for dashboard, orders, menu, hours, payouts, setup, and settings", () => {
    const chrome = readVendor("VendorLayoutChrome.tsx");
    expect(chrome).toContain("/dashboard");
    expect(chrome).toContain("/orders");
    expect(chrome).toContain("/hours");
    expect(chrome).toContain("/payouts");
    expect(chrome).toContain("/setup");
    expect(chrome).toContain("wide={isWideWorkspace}");
  });
});

describe("vendor orders preserved behavior", () => {
  it("still wires live orders polling through shared dashboard context", () => {
    const page = readVendor("orders/page.tsx");
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    expect(page).toContain("loadVendorDashboardContext");
    expect(live).toContain("useVendorOrdersPoll");
    expect(live).toContain("VendorOrderCard");
  });
});

describe("vendor orders copy guardrails", () => {
  it("does not add payout or earnings language to orders surfaces", () => {
    const page = readVendor("orders/page.tsx");
    const workbench = readVendor("orders/VendorOrdersWorkbench.tsx");
    const live = readVendor("dashboard/VendorDashboardLiveOrders.tsx");
    expect(page).not.toMatch(/\bearnings\b|\brevenue share\b/i);
    expect(workbench).not.toMatch(/\bearnings\b|\brevenue share\b/i);
    expect(live).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayouts?\b/i);
  });

  it("explains POS-controlled boards in plain English", () => {
    const workbench = readVendor("orders/VendorOrdersWorkbench.tsx");
    expect(workbench).toContain("VENDOR_POS_BOARD_READONLY_COPY");
  });
});
