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

  it("settings card shows payout account status and owner action copy", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card).toContain("Payout account");
    expect(card).toContain("recipientConnectStatus");
    expect(card).toContain("Payout account owner action required");
    expect(card).toContain("Pod payouts are sent to the pod payout account");
    expect(card).toContain("Pod settings → Payout account");
    expect(card).toContain("/settings#payout-setup");
    expect(card).toContain("Payout account ready");
    expect(card).toContain("signed in as the payout account owner");
  });

  it("settings card does not offer admin payout setup or manage actions", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card).not.toContain("Set up payout account");
    expect(card).not.toContain("Manage payout account");
    expect(card).not.toContain("Continue payout setup");
    expect(card).not.toContain("startPodPayoutConnectOnboarding");
    expect(card).not.toContain("openPodPayoutAccountManagement");
    expect(card).not.toContain("pod-payout-connect.actions");
  });

  it("settings card uses layman-friendly pod payout fields", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card).toContain("updatePodPayoutSettingsAction");
    expect(card).toContain("Pod payouts");
    expect(card).toContain("Pod share");
    expect(card).toContain("Payout account owner");
    expect(card).toContain("podSharePercent");
    expect(card).toContain("minimumPayoutDollars");
    expect(card).toContain("podRevenueSharePercentToBps");
    expect(card).toContain("minimumPayoutDollarsToCents");
    expect(card).toContain("Pending payout records");
    expect(card).toContain("Needs review");
    expect(card).toContain("Total calculated");
    expect(card.toLowerCase()).toContain("eligible food");
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

describe("admin pod payout P3.1 guardrails", () => {
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

  it("admin pod payout UI avoids legacy recipient/bps/cents copy", () => {
    const card = readAdminPod("PodPayoutSettingsCard.tsx");
    expect(card.toLowerCase()).not.toContain("basis points");
    expect(card).not.toContain("Designated recipient");
    expect(card).not.toContain("Minimum payout (¢)");
    expect(card).not.toContain("Revenue share (basis points)");
  });

  it("admin pod page does not import executable pod payout connect actions", () => {
    const page = readAdminPod("page.tsx");
    expect(page).not.toContain("pod-payout-connect.actions");
    expect(page).not.toContain("openPodPayoutAccountManagement");
    expect(page).not.toContain("startPodPayoutConnectOnboarding");
  });

  it("pod dashboard still has no earnings UI", () => {
    const metrics = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"),
      "utf8"
    );
    expect(metrics).not.toMatch(/podPayout|PodPayoutAllocation|earnings|payout amount/i);
  });

  it("P2/P3 services do not create Stripe transfers", () => {
    const settingsService = readFileSync(
      join(root, "services/pod-payout-settings.service.ts"),
      "utf8"
    );
    const allocationService = readFileSync(
      join(root, "services/pod-payout-allocation.service.ts"),
      "utf8"
    );
    const connectService = readFileSync(join(root, "services/pod-payout-connect.service.ts"), "utf8");
    const actions = readFileSync(
      join(root, "actions/admin-pod-payout-settings.actions.ts"),
      "utf8"
    );
    const connectActions = readFileSync(join(root, "actions/pod-payout-connect.actions.ts"), "utf8");
    for (const src of [settingsService, allocationService, actions, connectService, connectActions]) {
      expect(src).not.toMatch(/stripe\.transfers\.create/i);
      expect(src).not.toContain("VendorPayoutTransfer");
    }
  });
});
