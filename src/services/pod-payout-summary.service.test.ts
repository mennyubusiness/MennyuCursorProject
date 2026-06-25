import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockCanViewPodPayouts, mockPrisma } = vi.hoisted(() => {
  const mockCanViewPodPayouts = vi.fn();
  const mockPrisma = {
    podPayoutSettings: { findUnique: vi.fn() },
    podPayoutAllocation: { findMany: vi.fn() },
    podPayoutTransfer: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  return { mockCanViewPodPayouts, mockPrisma };
});

vi.mock("@/lib/permissions", () => ({
  canViewPodPayouts: (...args: unknown[]) => mockCanViewPodPayouts(...args),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { getPodOwnerPayoutSummary } from "./pod-payout-summary.service";

describe("getPodOwnerPayoutSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-designated viewer", async () => {
    mockCanViewPodPayouts.mockResolvedValue(false);
    const result = await getPodOwnerPayoutSummary("pod_1", "user_manager");
    expect(result).toBeNull();
    expect(mockPrisma.podPayoutAllocation.findMany).not.toHaveBeenCalled();
  });

  it("returns disabled state for designated recipient when payouts disabled", async () => {
    mockCanViewPodPayouts.mockResolvedValue(true);
    mockPrisma.podPayoutSettings.findUnique.mockResolvedValue({
      podPayoutsEnabled: false,
      podRevenueShareBps: 75,
      minimumPayoutCents: 1000,
    });

    const result = await getPodOwnerPayoutSummary("pod_1", "user_owner");
    expect(result?.enabled).toBe(false);
    expect(result?.podSharePercentLabel).toBe("0.75%");
    expect(result?.minimumPayoutLabel).toBe("$10");
  });

  it("aggregates pending allocations for designated recipient", async () => {
    mockCanViewPodPayouts.mockResolvedValue(true);
    mockPrisma.podPayoutSettings.findUnique.mockResolvedValue({
      podPayoutsEnabled: true,
      podRevenueShareBps: 75,
      minimumPayoutCents: 0,
    });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([
      { status: "pending", podPayoutAmountCents: 500 },
      { status: "cancelled_due_to_refund", podPayoutAmountCents: 100 },
    ]);
    mockPrisma.podPayoutTransfer.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({
      podPayoutStripeConnectedAccountId: "acct_1",
      podPayoutStripeChargesEnabled: true,
      podPayoutStripePayoutsEnabled: true,
      podPayoutStripeRequirementsCurrentlyDue: [],
    });

    const result = await getPodOwnerPayoutSummary("pod_1", "user_owner");
    expect(result?.pendingAllocationAmountCents).toBe(500);
    expect(result?.pendingAllocationCount).toBe(1);
    expect(result?.cancelledAmountCents).toBe(100);
    expect(result?.payoutSetupReady).toBe(true);
  });

  it("does not import vendor payout models", async () => {
    mockCanViewPodPayouts.mockResolvedValue(true);
    mockPrisma.podPayoutSettings.findUnique.mockResolvedValue({
      podPayoutsEnabled: true,
      podRevenueShareBps: 75,
      minimumPayoutCents: 0,
    });
    mockPrisma.podPayoutAllocation.findMany.mockResolvedValue([]);
    mockPrisma.podPayoutTransfer.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({
      podPayoutStripeConnectedAccountId: null,
      podPayoutStripeChargesEnabled: false,
      podPayoutStripePayoutsEnabled: false,
      podPayoutStripeRequirementsCurrentlyDue: [],
    });

    await getPodOwnerPayoutSummary("pod_1", "user_owner");
    expect(mockPrisma.podPayoutAllocation.findMany).toHaveBeenCalled();
  });
});
