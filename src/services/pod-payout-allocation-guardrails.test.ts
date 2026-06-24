import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("pod payout P1 guardrails", () => {
  it("allocation service does not call Stripe transfer APIs", () => {
    const service = readFileSync(
      join(root, "services/pod-payout-allocation.service.ts"),
      "utf8"
    );
    expect(service).not.toMatch(/stripe\.transfers\.create/i);
    expect(service).not.toMatch(/from "@\/lib\/stripe"/);
    expect(service).not.toContain("VendorPayoutTransfer");
    expect(service).not.toContain("PaymentAllocation");
  });

  it("payment hook creates pod allocation in same transaction as vendor payouts", () => {
    const paymentService = readFileSync(join(root, "services/payment.service.ts"), "utf8");
    expect(paymentService).toContain("ensurePodPayoutAllocationForPaymentInTx");
    expect(paymentService).toContain("ensureVendorPayoutTransferRecordsForPaymentInTx");
    const hookIndex = paymentService.indexOf("ensurePodPayoutAllocationForPaymentInTx");
    const vendorIndex = paymentService.indexOf("ensureVendorPayoutTransferRecordsForPaymentInTx");
    expect(hookIndex).toBeGreaterThan(vendorIndex);
  });

  it("pod dashboard does not expose payout earnings", () => {
    const metrics = readFileSync(
      join(root, "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"),
      "utf8"
    );
    const page = readFileSync(join(root, "app/pod/[podId]/dashboard/page.tsx"), "utf8");
    expect(metrics).not.toMatch(/podPayout|PodPayoutAllocation|earnings|payout amount/i);
    expect(page).not.toContain("pod-payout-allocation");
    expect(page).not.toContain("PodPayoutAllocation");
  });

  it("pod owner routes do not import vendor payout transfer services", () => {
    const podAppDir = join(root, "app/pod");
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
      return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
      });
    };
    const files = walk(podAppDir);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("vendor-payout-transfer");
      expect(src).not.toContain("VendorPayoutTransfer");
      expect(src).not.toContain("PaymentAllocation");
    }
  });

  it("admin pod detail shows allocation summary without pod owner route exposure", () => {
    const adminPod = readFileSync(
      join(root, "app/admin/(dashboard)/pods/[podId]/page.tsx"),
      "utf8"
    );
    expect(adminPod).toContain("podPayoutAllocation");
    expect(adminPod).toContain("Pod owner payouts (admin)");
  });
});
