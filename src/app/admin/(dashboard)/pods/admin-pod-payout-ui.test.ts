import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");
const adminPodDir = join(root, "app/admin/(dashboard)/pods/[podId]");

function readAdminPod(relativePath: string): string {
  return readFileSync(join(adminPodDir, relativePath), "utf8");
}

describe("admin pod payout P2 UI", () => {
  it("pod detail loads payout settings and allocations cards", () => {
    const page = readAdminPod("page.tsx");
    expect(page).toContain("PodPayoutSettingsCard");
    expect(page).toContain("PodPayoutAllocationsCard");
    expect(page).toContain("getPodPayoutAllocationSummary");
    expect(page).toContain("listRecentPodPayoutAllocationsForAdmin");
    expect(page).toContain("getPodPayoutRecipientConnectStatusForPod");
  });

  it("settings card shows recipient connect status", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card).toContain("Recipient payout setup");
    expect(card).toContain("recipientConnectStatus");
    expect(card).toContain("Recipient must complete payout setup from pod settings");
  });

  it("settings card uses admin action and pod payout copy", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card).toContain("updatePodPayoutSettingsAction");
    expect(card).toContain("Pod payouts");
    expect(card).toContain("Revenue share");
    expect(card).toContain("Designated recipient");
    expect(card.toLowerCase()).toContain("eligible food subtotal");
    expect(card).not.toMatch(/Stripe transfer/i);
    expect(card).not.toContain("VendorPayoutTransfer");
  });

  it("allocations card shows safe review fields", () => {
    const card = readAdminPod("PodPayoutAllocationsCard.tsx");
    expect(card).toContain("Eligible food subtotal");
    expect(card).toContain("blockedReasonLabel");
    expect(card).toContain("/admin/orders/");
    expect(card).not.toMatch(/vendor payout|VendorPayoutTransfer/i);
    expect(card).not.toMatch(/Stripe transfer/i);
  });

  it("allocations card supports status filters", () => {
    const card = readAdminPod("PodPayoutAllocationsCard.tsx");
    expect(card).toContain("POD_PAYOUT_ALLOCATION_STATUS.pending");
    expect(card).toContain("POD_PAYOUT_ALLOCATION_STATUS.blocked");
    expect(card).toContain("cancelledDueToRefund");
  });
});

describe("admin pod payout P2 guardrails", () => {
  it("pod owner routes do not import admin pod payout actions", () => {
    const podAppDir = join(root, "app/pod");
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
      return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
      });
    };
    for (const file of walk(podAppDir)) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("admin-pod-payout-settings");
      expect(src).not.toContain("updatePodPayoutSettingsAction");
    }
  });

  it("pod dashboard still has no earnings UI", () => {
    const metrics = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"),
      "utf8"
    );
    expect(metrics).not.toMatch(/podPayout|PodPayoutAllocation|earnings|payout amount/i);
  });

  it("P2 services do not create Stripe transfers", () => {
    const settingsService = readFileSync(
      join(root, "services/pod-payout-settings.service.ts"),
      "utf8"
    );
    const allocationService = readFileSync(
      join(root, "services/pod-payout-allocation.service.ts"),
      "utf8"
    );
    const actions = readFileSync(
      join(root, "actions/admin-pod-payout-settings.actions.ts"),
      "utf8"
    );
    for (const src of [settingsService, allocationService, actions]) {
      expect(src).not.toMatch(/stripe\.transfers/i);
      expect(src).not.toContain("VendorPayoutTransfer");
    }
  });
});
