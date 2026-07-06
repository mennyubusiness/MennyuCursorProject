import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: vi.fn(),
    },
    menuVersion: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { manualDashboardOrderAdapter } from "@/lib/integrations/adapters/manual-dashboard-order.adapter";
import { openOrderMenuAdapter } from "@/lib/integrations/adapters/open-order-menu.adapter";

describe("manual dashboard order adapter", () => {
  beforeEach(() => {
    vi.mocked(prisma.vendor.findUnique).mockReset();
  });

  it("returns not ready when vendor uses deliverect routing", async () => {
    vi.mocked(prisma.vendor.findUnique).mockResolvedValue({
      orderRoutingMode: "deliverect",
      isActive: true,
      deletedAt: null,
    } as never);

    const health = await manualDashboardOrderAdapter.validateConnection({ vendorId: "v1" });
    expect(health.isReady).toBe(false);
    expect(health.missingRequirements.some((m) => m.includes("manual dashboard"))).toBe(true);
  });

  it("returns ready for manual dashboard vendor", async () => {
    vi.mocked(prisma.vendor.findUnique).mockResolvedValue({
      orderRoutingMode: "manual_dashboard",
      isActive: true,
      deletedAt: null,
    } as never);

    const health = await manualDashboardOrderAdapter.validateConnection({ vendorId: "v1" });
    expect(health.isReady).toBe(true);
    expect(health.status).toBe("connected");
  });

  it("submitOrder is skipped without external call", async () => {
    const result = await manualDashboardOrderAdapter.submitOrder({} as never);
    expect(result.skipped).toBe(true);
    expect(result.success).toBe(true);
  });
});

describe("open order menu adapter", () => {
  beforeEach(() => {
    vi.mocked(prisma.vendor.findUnique).mockReset();
    vi.mocked(prisma.menuVersion.findFirst).mockReset();
  });

  it("requires published menu version", async () => {
    vi.mocked(prisma.vendor.findUnique).mockResolvedValue({
      menuSource: "open_order",
      isActive: true,
      deletedAt: null,
    } as never);
    vi.mocked(prisma.menuVersion.findFirst).mockResolvedValue(null);

    const health = await openOrderMenuAdapter.validateConnection({ vendorId: "v1" });
    expect(health.isReady).toBe(false);
    expect(health.missingRequirements).toContain("No published menu version");
  });
});
