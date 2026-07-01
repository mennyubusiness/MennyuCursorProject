import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function readVendor(relativePath: string): string {
  return readFileSync(join(vendorDir, relativePath), "utf8");
}

describe("vendor orders ledger layout", () => {
  it("uses DashboardShell command tier on the orders page", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain('tier="command"');
    expect(page).toContain("DashboardShell");
  });

  it("uses shared DashboardPageHeader with ledger copy", () => {
    const page = readVendor("orders/page.tsx");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain('title="Orders"');
    expect(page).toContain("Chronological order ledger");
  });

  it("routes orders through VendorOrdersLedger with filters and kitchen mode", () => {
    const page = readVendor("orders/page.tsx");
    const workbench = readVendor("orders/VendorOrdersWorkbench.tsx");
    const ledger = readVendor("orders/VendorOrdersLedger.tsx");
    expect(page).toContain("VendorOrdersWorkbench");
    expect(workbench).toContain("VendorOrdersLedger");
    expect(ledger).toContain("VENDOR_ORDERS_LEDGER_FILTERS");
    expect(ledger).toContain("Open Kitchen Mode");
    expect(ledger).toContain("VendorKitchenPauseToggle");
    expect(ledger).not.toContain("VendorDashboardLiveOrders");
    expect(ledger).not.toContain("filterVendorOrdersForHistory");
  });
});

describe("vendor orders nav cleanup", () => {
  it("removes Issues from vendor area nav", () => {
    const nav = readVendor("VendorAreaNav.tsx");
    expect(nav).not.toContain('`${base}/issues`');
    expect(nav).toContain("Kitchen");
  });
});

describe("vendor orders preserved behavior", () => {
  it("still wires live orders polling through ledger", () => {
    const page = readVendor("orders/page.tsx");
    const ledger = readVendor("orders/VendorOrdersLedger.tsx");
    expect(page).toContain("loadVendorDashboardContext");
    expect(ledger).toContain("useVendorOrdersPoll");
  });
});

describe("vendor orders copy guardrails", () => {
  it("does not add payout or earnings language to orders surfaces", () => {
    const page = readVendor("orders/page.tsx");
    const ledger = readVendor("orders/VendorOrdersLedger.tsx");
    expect(page).not.toMatch(/\bearnings\b|\brevenue share\b/i);
    expect(ledger).not.toMatch(/\bearnings\b|\brevenue share\b/i);
  });

  it("explains POS-controlled boards in plain English", () => {
    const ledger = readVendor("orders/VendorOrdersLedger.tsx");
    expect(ledger).toContain("VENDOR_POS_BOARD_READONLY_COPY");
  });
});
