import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();
const root = join(cwd, "src");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("schema and migration", () => {
  const schema = readFileSync(join(cwd, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(cwd, "prisma/migrations/20260903230000_pod_vendor_ordering_enabled/migration.sql"),
    "utf8"
  );

  it("declares orderingEnabled on Pod and Vendor defaulting to true", () => {
    const matches = schema.match(/orderingEnabled\s+Boolean\s+@default\(true\)/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  /** Existing production rows must stay orderable: additive column, NOT NULL, DEFAULT true. */
  it("adds the columns additively so existing rows stay orderable", () => {
    expect(migration).toMatch(
      /ALTER TABLE "Pod" ADD COLUMN IF NOT EXISTS "orderingEnabled" BOOLEAN NOT NULL DEFAULT true/
    );
    expect(migration).toMatch(
      /ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "orderingEnabled" BOOLEAN NOT NULL DEFAULT true/
    );
  });

  it("does not backfill to false or touch menu, routing, or payment columns", () => {
    expect(migration).not.toMatch(/UPDATE\s+"(Pod|Vendor|MenuItem|MenuVersion)"/i);
    expect(migration).not.toMatch(/DEFAULT false/i);
    expect(migration).not.toMatch(/menuSource|orderRoutingMode|isAvailable|stripe/i);
  });

  it("keeps menu-only intent separate from the temporary pause field", () => {
    expect(schema).toMatch(/mennyuOrdersPaused/);
    expect(schema).toMatch(/Distinct from `mennyuOrdersPaused`/);
  });
});

describe("admin authorization for ordering mode", () => {
  const vendorActions = read("actions/admin-vendor.actions.ts");
  const podActions = read("actions/admin-pod.actions.ts");

  /** Stage 1 keeps the control point with platform admins only. */
  it("routes both ordering-mode actions through withAdmin", () => {
    expect(vendorActions).toMatch(
      /adminSetVendorOrderingModeAction[\s\S]{0,240}?withAdmin\(/
    );
    expect(podActions).toMatch(/adminSetPodOrderingModeAction[\s\S]{0,240}?withAdmin\(/);
  });

  it("does not expose ordering-mode controls to pod owners", () => {
    const podOwnerActions = read("actions/pod-settings.actions.ts");
    expect(podOwnerActions).not.toMatch(/orderingEnabled/);
    for (const file of [
      "app/pod/[podId]/dashboard/PodVendorRosterPanel.tsx",
      "app/pod/[podId]/settings/page.tsx",
    ]) {
      expect(read(file)).not.toMatch(/adminSet(Pod|Vendor)OrderingMode/);
    }
  });
});

describe("admin ordering-mode controls", () => {
  it("gives the vendor page an ordering control separate from the pause control", () => {
    const overview = read("app/admin/(dashboard)/vendors/[vendorId]/AdminVendorOverview.tsx");
    expect(overview).toContain("adminSetVendorOrderingModeAction");
    expect(overview).toContain("ORDERING_MODE_COPY");
    expect(overview).toContain("adminPauseVendorOrderingAction");
  });

  it("gives the pod page a pod-wide ordering control and a per-vendor one on each row", () => {
    const overview = read("app/admin/(dashboard)/pods/[podId]/AdminPodOverview.tsx");
    expect(overview).toContain("adminSetPodOrderingModeAction");
    expect(overview).toContain('title="Ordering mode"');
    expect(overview).toContain("adminSetVendorOrderingModeAction");
  });

  it("lets admins filter the vendor list by ordering mode", () => {
    const form = read("app/admin/(dashboard)/vendors/AdminVendorSearchForm.tsx");
    const page = read("app/admin/(dashboard)/vendors/page.tsx");
    expect(form).toContain("orderingMode");
    expect(form).toContain("menu_only");
    expect(page).toContain("orderingMode");
  });
});

describe("customer surfaces in menu-only mode", () => {
  it("uses a browse CTA instead of a disabled order button on pod vendor cards", () => {
    const card = read("components/pod/PodVendorCard.tsx");
    expect(card).toContain("VENDOR_MENU_ONLY_CTA");
    expect(card).not.toMatch(/disabled.*Order now/);
  });

  it("shows the menu-only status once near the vendor hero", () => {
    const hero = read("components/vendor-menu/VendorMenuHero.tsx");
    expect(hero).toContain("MENU_ONLY_BADGE");
    expect(hero).toMatch(/menuOnly/);
  });

  it("gives a fully menu-only pod a neutral browsing status", () => {
    const status = read("lib/pod-page-status.ts");
    expect(status).toContain("POD_MENU_ONLY_STATUS");
    expect(status).toContain('"menu_only"');
    expect(status).not.toMatch(/No vendors are accepting orders/);
  });

  it("hides group-order CTAs when nothing in the pod is orderable", () => {
    expect(read("lib/pod-customer-page-data.ts")).toContain("hasOrderableVendor");
    expect(read("components/pod/StandardPodPageView.tsx")).toContain("hasOrderableVendor");
    expect(read("components/pod/PodPageHeroActions.tsx")).toContain("showGroupOrderCta");
    expect(read("lib/destination-pod-group-prompt.ts")).toContain('orderingTone === "menu_only"');
  });
});

describe("vendor dashboard in menu-only mode", () => {
  it("drives nav visibility from the shared nav mode rather than inline flag checks", () => {
    const nav = read("app/vendor/[vendorId]/VendorAreaNav.tsx");
    expect(nav).toContain("isVendorNavHrefVisible");
    expect(nav).toContain("vendorNavShowsKitchen");
    expect(nav).not.toMatch(/orderingEnabled/);
  });

  it("replaces order-first dashboard content with menu status", () => {
    const card = read("app/vendor/[vendorId]/dashboard/VendorStoreStatusCard.tsx");
    const page = read("app/vendor/[vendorId]/dashboard/page.tsx");
    expect(card).toContain("VENDOR_MENU_ONLY_DASHBOARD_TITLE");
    expect(card).toContain("Menu status");
    expect(page).toContain("ctx.menuOnly");
  });

  it("suppresses payment nagging and hides payouts from quick links", () => {
    const payouts = read("app/vendor/[vendorId]/payouts/page.tsx");
    const quickLinks = read("app/vendor/[vendorId]/dashboard/VendorQuickLinksSection.tsx");
    expect(payouts).toContain("orderingMode.menuOnly");
    expect(quickLinks).toContain("MENU_ONLY_HIDDEN_LINKS");
  });

  it("drops commerce items from the setup checklist while menu-only", () => {
    const readiness = read("lib/vendor-pod-readiness.ts");
    expect(readiness).toContain("VENDOR_COMMERCE_CHECKLIST_KEYS");
    expect(readiness).toContain("VENDOR_MENU_ONLY_SETUP_REQUIRED_CHECKLIST_KEYS");
    expect(read("app/vendor/[vendorId]/setup/page.tsx")).toContain("ctx.menuOnly");
  });

  it("says Hours instead of Customer ordering hours when menu-only", () => {
    const form = read("app/vendor/[vendorId]/hours/VendorCustomerOrderingHoursForm.tsx");
    expect(form).toMatch(/menuOnly \? "Hours" : "Customer ordering hours"/);
  });
});

describe("pod dashboard in menu-only mode", () => {
  it("reports listed vendors instead of orderable vendors", () => {
    const card = read("app/pod/[podId]/dashboard/PodStatusCard.tsx");
    const activity = read("app/pod/[podId]/dashboard/PodTodayActivitySection.tsx");
    expect(card).toContain("Listed vendors");
    expect(card).toContain("podMenuOnly");
    expect(activity).toContain("podMenuOnly");
    expect(activity).toContain("Menus live");
  });

  it("does not raise ordering-readiness attention for an intentionally menu-only pod", () => {
    const attention = read("lib/pod-dashboard-attention.ts");
    expect(attention).toContain("noOrderingIntent");
    expect(attention).toMatch(/orderableVendorCount === 0 && !noOrderingIntent/);
  });

  it("labels menu-only vendors as menu-only rather than blocked in the roster", () => {
    const adoption = read("lib/pod-vendor-adoption.ts");
    const summary = read("app/pod/[podId]/dashboard/PodRosterReadinessSummary.tsx");
    expect(adoption).toContain("VENDOR_ORDERING_MODE_LABELS");
    expect(adoption).toContain("menuOnlyCount");
    expect(summary).toContain("menuOnly ? null");
  });
});

describe("existing orders survive ordering being turned off", () => {
  /** Disabling ordering blocks new orders only; nothing may filter existing work out of view. */
  it("does not filter order queries by ordering intent", () => {
    for (const file of [
      "lib/vendor-orders-board-data.ts",
      "app/api/vendor/[vendorId]/orders/route.ts",
      "services/admin-vendor-detail.service.ts",
    ]) {
      expect(read(file)).not.toMatch(/vendorOrder\.findMany[\s\S]{0,600}?orderingEnabled/);
    }
  });

  it("keeps kitchen and order surfaces available while a ticket is in flight", () => {
    const navMode = read("lib/vendor-dashboard-nav-mode.ts");
    const loader = read("lib/vendor-dashboard-ordering-mode.server.ts");
    expect(navMode).toContain("hasActiveOrders");
    expect(navMode).toContain("hasOrderHistory");
    expect(loader).toContain("hasActiveOrders");
    expect(loader).toContain("hasOrderHistory");
  });

  it("still renders the active orders section for a menu-only vendor with live tickets", () => {
    const page = read("app/vendor/[vendorId]/dashboard/page.tsx");
    expect(page).toMatch(/!ctx\.menuOnly \|\| hasActiveOrders/);
  });
});

describe("integration configuration is never touched by ordering mode", () => {
  it("keeps the ordering-mode services free of menu, routing, and payment writes", () => {
    for (const file of [
      "services/admin-vendor-rescue.service.ts",
      "services/admin-pod-rescue.service.ts",
    ]) {
      const src = read(file);
      const modeFn = src.slice(
        src.indexOf("OrderingMode(input: {"),
        src.indexOf("OrderingMode(input: {") + 2500
      );
      expect(modeFn).not.toMatch(/menuSource|orderRoutingMode|stripe|square|deliverect/i);
      expect(modeFn).not.toMatch(/menuItem\.updateMany|repairVendorMenuSourceOwnership/);
    }
  });
});
