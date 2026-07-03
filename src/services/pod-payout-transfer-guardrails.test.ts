import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

describe("pod payout transfer P4 guardrails", () => {
  it("schema includes PodPayoutTransfer linked to PodPayoutAllocation", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    expect(schema).toContain("model PodPayoutTransfer");
    expect(schema).toContain("podPayoutAllocationId String    @unique");
    expect(schema).toContain("podPayoutTransfer      PodPayoutTransfer?");
  });

  it("pod payout transfer service does not import VendorPayoutTransfer", () => {
    const service = readFileSync(join(root, "src/services/pod-payout-transfer.service.ts"), "utf8");
    expect(service).not.toContain("VendorPayoutTransfer");
    expect(service).not.toContain("vendor-payout-transfer.service");
    expect(service).toMatch(/stripe\.transfers\.create/);
  });

  it("vendor payout transfer service does not import PodPayoutTransfer", () => {
    const service = readFileSync(join(root, "src/services/vendor-payout-transfer.service.ts"), "utf8");
    expect(service).not.toContain("PodPayoutTransfer");
    expect(service).not.toContain("pod-payout-transfer");
  });

  it("payment capture does not create pod payout transfer rows", () => {
    const paymentService = readFileSync(join(root, "src/services/payment.service.ts"), "utf8");
    expect(paymentService).not.toContain("ensurePodPayoutTransfer");
    expect(paymentService).not.toContain("PodPayoutTransfer");
  });

  it("pod owner routes do not import pod payout transfer batch actions", () => {
    const podAppDir = join(root, "src/app/pod");
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
      return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
      });
    };
    for (const file of walk(podAppDir)) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("admin-pod-payout-transfer");
      expect(src).not.toContain("adminRunPodPayoutTransferBatchAction");
    }
  });

  it("pod dashboard has no payout earnings UI", () => {
    const metrics = readFileSync(
      join(root, "src/app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"),
      "utf8"
    );
    expect(metrics).not.toMatch(/podPayoutTransfer|PodPayoutTransfer|earnings|payout amount/i);
  });

  it("no scheduled pod payout transfer route exists", () => {
    const apiDir = join(root, "src/app/api");
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
      if (!statSync(dir).isDirectory()) return [];
      return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
      });
    };
    for (const file of walk(apiDir)) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("runManualPodPayoutTransferBatchForPod");
    }
  });

  it("admin pod page uses transfer card but not direct stripe calls", () => {
    const page = readFileSync(
      join(root, "src/app/admin/(dashboard)/pods/[podId]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("AdminPodPayoutSection");
    expect(page).toContain("getPodPayoutTransferAdminSummary");
    expect(page).not.toMatch(/stripe\.transfers\.create/);
  });
});
