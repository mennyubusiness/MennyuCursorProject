import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminDir = join(dirname(fileURLToPath(import.meta.url)));
const root = join(process.cwd(), "src");

function readAdmin(relativePath: string): string {
  return readFileSync(join(adminDir, relativePath), "utf8");
}

describe("admin home dashboard layout", () => {
  it("uses shared dashboard primitives with admin tier shell", () => {
    const page = readAdmin("page.tsx");
    const styles = readFileSync(join(root, "components/dashboard/dashboard-styles.ts"), "utf8");

    expect(page).toContain("DashboardShell");
    expect(page).toContain('tier="admin"');
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain("DashboardMetricGrid");
    expect(page).toContain("DashboardMetricCard");
    expect(page).toContain("DashboardSection");
    expect(page).toContain("DashboardCard");
    expect(styles).toContain('admin: "w-full"');
  });

  it("removes narrow max-w-2xl header constraint", () => {
    const page = readAdmin("page.tsx");
    expect(page).not.toContain("max-w-2xl");
  });

  it("uses admin home header copy", () => {
    const page = readAdmin("page.tsx");
    expect(page).toContain('title="Admin"');
    expect(page).toContain("Monitor Open Order operations, marketplace setup, and support workflows");
  });

  it("groups quick links by operational area", () => {
    const page = readAdmin("page.tsx");
    expect(page).toContain("Orders & issues");
    expect(page).toContain("Marketplace");
    expect(page).toContain("Operations");
    expect(page).toContain("Settings");
  });
});

describe("admin home quick links", () => {
  it("keeps core admin routes wired", () => {
    const page = readAdmin("page.tsx");
    const routes = [
      "/admin/orders",
      "/admin/exceptions",
      "/admin/vendors",
      "/admin/pods",
      "/admin/payout-transfers",
      "/admin/deliverect-webhook-incidents",
      "/admin/deliverect-connections",
      "/admin/pricing",
      "/admin/analytics",
    ];

    for (const route of routes) {
      expect(page).toContain(route);
    }
  });

  it("uses readable link labels on the home page", () => {
    const page = readAdmin("page.tsx");
    expect(page).toContain("Order issues");
    expect(page).toContain("Vendor transfers");
    expect(page).toContain("POS connections");
    expect(page).toContain("Platform pricing");
  });
});

describe("admin home preserved behavior", () => {
  it("keeps existing prisma metrics queries unchanged", () => {
    const page = readAdmin("page.tsx");
    expect(page).toContain("prisma.order.count");
    expect(page).toContain("prisma.vendorOrder.count");
    expect(page).toContain("prisma.vendor.count");
    expect(page).toContain("VendorRoutingStatus.failed");
    expect(page).toContain("ROUTING_STUCK_THRESHOLD_MINUTES");
    expect(page).not.toContain("redirect(");
  });

  it("keeps AdminTopNav in the admin layout", () => {
    const layout = readFileSync(join(root, "app/admin/layout.tsx"), "utf8");
    expect(layout).toContain("AdminTopNav");
    expect(layout).toContain("oo-shell");
  });

  it("preserves admin auth gate in dashboard layout", () => {
    const layout = readAdmin("layout.tsx");
    expect(layout).toContain("isAdminDashboardLayoutAuthorized");
    expect(layout).toContain("/admin/access-denied");
  });

  it("does not show admin mode banner in admin shell layout", () => {
    const layout = readFileSync(join(root, "app/admin/layout.tsx"), "utf8");
    expect(layout).not.toContain("AdminModeBanner");
    expect(layout).not.toContain("shouldShowAdminModeBanner");
  });
});

describe("admin home copy guardrails", () => {
  it("does not use pod-owner or vendor-operator copy on admin home", () => {
    const page = readAdmin("page.tsx");
    expect(page).not.toMatch(/your pod|kitchen mode|ready for orders/i);
    expect(page).not.toMatch(/customer pickup flow/i);
  });

  it("surfaces order issues alert with dashboard status styling", () => {
    const page = readAdmin("page.tsx");
    expect(page).toContain("DashboardStatusBadge");
    expect(page).toContain("Open order issues");
    expect(page).toContain('variant="warning"');
  });
});
