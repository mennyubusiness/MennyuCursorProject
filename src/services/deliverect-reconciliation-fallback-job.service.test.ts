import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockAttemptFallback = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/services/deliverect-reconciliation-fallback.service", () => ({
  attemptDeliverectReconciliationFallback: (...args: unknown[]) => mockAttemptFallback(...args),
}));

import {
  findVendorOrdersEligibleForAutomaticDeliverectFallback,
  runDeliverectAutomaticReconciliationFallback,
} from "./deliverect-reconciliation-fallback-job.service";

const VO_ID = `c${"a".repeat(24)}`;
const NOW = new Date("2026-01-01T13:00:00.000Z");

describe("deliverect-reconciliation-fallback-job.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([{ id: VO_ID }]);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue({});
    mockAttemptFallback.mockResolvedValue({
      outcome: "applied",
      deliverectWebhookApplyOutcome: "applied",
      updatedVendorOrderState: true,
      lookupDeliverectOrderId: "dlv_1",
    });
  });

  it("finds overdue sent orders awaiting reconciliation", async () => {
    const ids = await findVendorOrdersEligibleForAutomaticDeliverectFallback({ now: NOW, take: 10 });

    expect(ids).toEqual([VO_ID]);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          routingStatus: "sent",
          fulfillmentStatus: "pending",
          lastExternalStatusAt: null,
          deliverectAutoRecheckAttemptedAt: null,
        }),
        take: 10,
      })
    );
  });

  it("claims row, runs fallback, and records result code", async () => {
    const summary = await runDeliverectAutomaticReconciliationFallback({ now: NOW, take: 5 });

    expect(summary).toMatchObject({
      scanned: 1,
      claimed: 1,
      attempted: 1,
      successApplied: 1,
      errors: 0,
    });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: VO_ID, deliverectAutoRecheckAttemptedAt: null }),
        data: { deliverectAutoRecheckAttemptedAt: NOW },
      })
    );
    expect(mockAttemptFallback).toHaveBeenCalledWith(VO_ID, {
      onlyIfOverdue: true,
      allowAfterManualRecovery: false,
      trigger: "automatic",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: VO_ID },
      data: { deliverectAutoRecheckResult: "applied" },
    });
  });

  it("skips already-claimed rows on repeated job runs (idempotent)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const summary = await runDeliverectAutomaticReconciliationFallback({ now: NOW });

    expect(summary.skippedAlreadyClaimed).toBe(1);
    expect(summary.attempted).toBe(0);
    expect(mockAttemptFallback).not.toHaveBeenCalled();
  });

  it("records error code when fallback throws", async () => {
    mockAttemptFallback.mockRejectedValue(new Error("apply pipeline failed"));

    const summary = await runDeliverectAutomaticReconciliationFallback({ now: NOW });

    expect(summary.errors).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: VO_ID },
      data: { deliverectAutoRecheckResult: "error:apply pipeline failed" },
    });
  });
});
