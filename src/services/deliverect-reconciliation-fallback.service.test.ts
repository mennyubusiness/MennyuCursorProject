import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFetchOrder = vi.fn();
const mockApplyFallback = vi.fn();

vi.mock("@/lib/env", () => ({
  env: { ROUTING_MODE: "deliverect" },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/integrations/deliverect/client", () => ({
  extractDeliverectOrderId: vi.fn(() => null),
  fetchDeliverectOrderById: (...args: unknown[]) => mockFetchOrder(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  applyDeliverectStatusFromFallbackLookup: (...args: unknown[]) => mockApplyFallback(...args),
}));

import { attemptDeliverectReconciliationFallback } from "./deliverect-reconciliation-fallback.service";

const VO_ID = `c${"a".repeat(24)}`;
const DLV_ID = "507f1f77bcf86cd799439011";
const SUBMITTED = new Date("2026-01-01T12:00:00.000Z");

function eligibleVo(overrides?: Record<string, unknown>) {
  return {
    id: VO_ID,
    orderId: "ord_1",
    routingStatus: "sent",
    fulfillmentStatus: "pending",
    lastExternalStatusAt: null,
    deliverectSubmittedAt: SUBMITTED,
    deliverectOrderId: DLV_ID,
    lastDeliverectResponse: null,
    deliverectChannelLinkId: "ch_test",
    manuallyRecoveredAt: null,
    statusAuthority: null,
    lastStatusSource: null,
    createdAt: SUBMITTED,
    vendor: { deliverectChannelLinkId: "ch_test" },
    ...overrides,
  };
}

describe("attemptDeliverectReconciliationFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(eligibleVo());
    mockFetchOrder.mockResolvedValue({
      ok: true,
      body: { status: 20, channelOrderId: VO_ID, _id: DLV_ID },
      httpStatus: 200,
    });
    mockApplyFallback.mockResolvedValue({
      outcome: "applied",
      orderId: "ord_1",
      vendorOrderId: VO_ID,
      updatedVendorOrderState: true,
    });
  });

  it("reconciles stalled sent order when Deliverect reports updated status", async () => {
    const result = await attemptDeliverectReconciliationFallback(VO_ID, {
      onlyIfOverdue: true,
      trigger: "automatic",
    });

    expect(result).toMatchObject({
      outcome: "applied",
      updatedVendorOrderState: true,
      lookupDeliverectOrderId: DLV_ID,
    });
    expect(mockFetchOrder).toHaveBeenCalledWith(DLV_ID);
    expect(mockApplyFallback).toHaveBeenCalledWith(VO_ID, DLV_ID, {
      status: 20,
      channelOrderId: VO_ID,
      _id: DLV_ID,
    });
  });

  it("does not reconcile when fulfillment is no longer pending", async () => {
    mockFindUnique.mockResolvedValue(eligibleVo({ fulfillmentStatus: "ready" }));

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result).toEqual({ outcome: "not_eligible", reason: "fulfillment_not_pending" });
    expect(mockFetchOrder).not.toHaveBeenCalled();
    expect(mockApplyFallback).not.toHaveBeenCalled();
  });

  it("does not reconcile when already externally reconciled", async () => {
    mockFindUnique.mockResolvedValue(
      eligibleVo({ lastExternalStatusAt: new Date("2026-01-01T12:30:00.000Z") })
    );

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result).toEqual({ outcome: "not_eligible", reason: "already_reconciled" });
    expect(mockFetchOrder).not.toHaveBeenCalled();
  });

  it("does not reconcile completed terminal fulfillment", async () => {
    mockFindUnique.mockResolvedValue(eligibleVo({ fulfillmentStatus: "completed" }));

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result).toEqual({ outcome: "not_eligible", reason: "fulfillment_not_pending" });
  });

  it("handles Deliverect GET failure safely", async () => {
    mockFetchOrder.mockResolvedValue({
      ok: false,
      error: "upstream_timeout",
      httpStatus: 504,
    });

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result).toMatchObject({
      outcome: "no_match",
      reason: "deliverect_get_failed:upstream_timeout",
      lookupDeliverectOrderId: DLV_ID,
    });
    expect(mockApplyFallback).not.toHaveBeenCalled();
  });

  it("returns noop when apply pipeline makes no row change", async () => {
    mockApplyFallback.mockResolvedValue({
      outcome: "noop_same_status",
      orderId: "ord_1",
      vendorOrderId: VO_ID,
      updatedVendorOrderState: false,
    });

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result).toEqual({
      outcome: "noop",
      deliverectWebhookApplyOutcome: "noop_same_status",
    });
  });

  it("rejects automatic run when not yet overdue", async () => {
    const recentSubmit = new Date();
    mockFindUnique.mockResolvedValue(eligibleVo({ deliverectSubmittedAt: recentSubmit }));

    const result = await attemptDeliverectReconciliationFallback(VO_ID, { onlyIfOverdue: true });

    expect(result).toEqual({ outcome: "not_eligible", reason: "not_overdue_yet" });
    expect(mockFetchOrder).not.toHaveBeenCalled();
  });

  it("rejects ambiguous Deliverect lookup match", async () => {
    mockFetchOrder.mockResolvedValue({
      ok: true,
      body: { status: 20, channelOrderId: "c" + "z".repeat(24) },
      httpStatus: 200,
    });

    const result = await attemptDeliverectReconciliationFallback(VO_ID);

    expect(result.outcome).toBe("ambiguous");
    expect(mockApplyFallback).not.toHaveBeenCalled();
  });
});
