import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockConnectionFind = vi.fn();
const mockEnsureToken = vi.fn();
const mockFetchOrder = vi.fn();
const mockApplyStatus = vi.fn();
const mockConnectionUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    vendorIntegrationConnection: {
      update: (...args: unknown[]) => mockConnectionUpdate(...args),
    },
  },
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockConnectionFind(...args),
  ensureSquareAccessToken: (...args: unknown[]) => mockEnsureToken(...args),
}));

vi.mock("@/lib/integrations/square/square-api.client", () => ({
  fetchSquareOrder: (...args: unknown[]) => mockFetchOrder(...args),
}));

vi.mock("@/services/vendor-order-status-instrumentation", () => ({
  applyVendorOrderStatusWithMeta: (...args: unknown[]) => mockApplyStatus(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  recomputeAndPersistParentStatus: vi.fn(),
}));

import { applySquareOrderStatusSync } from "@/services/square-status-sync.service";

describe("applySquareOrderStatusSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      vendorId: "vendor_1",
      routingStatus: "sent",
      fulfillmentStatus: "pending",
      squareOrderId: "sq_1",
      lastSquarePayload: null,
    });
    mockConnectionFind.mockResolvedValue({
      id: "conn_1",
      externalLocationId: "LOC_1",
      externalMerchantId: "MERCH_1",
      accessTokenRef: "ref",
    });
    mockEnsureToken.mockResolvedValue("token");
    mockFetchOrder.mockResolvedValue({
      order: {
        id: "sq_1",
        location_id: "LOC_1",
        state: "OPEN",
        fulfillments: [{ type: "PICKUP", state: "PREPARED" }],
      },
    });
    mockApplyStatus.mockResolvedValue("paid");
    mockUpdate.mockResolvedValue({});
    mockConnectionUpdate.mockResolvedValue({});
  });

  it("fetches Square order and applies ready status", async () => {
    const result = await applySquareOrderStatusSync({
      vendorOrderId: "vo_1",
      applySource: "admin_manual",
    });

    expect(result.outcome).toBe("applied");
    expect(result.updatedVendorOrderState).toBe(true);
    expect(mockFetchOrder).toHaveBeenCalledWith("token", "sq_1");
    expect(mockApplyStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ fulfillmentStatus: "ready", routingStatus: "confirmed" }),
        statusSource: "square_webhook",
        historySource: "square",
      }),
      "square_webhook"
    );
  });

  it("returns noop when status already matches", async () => {
    mockFindUnique.mockResolvedValue({
      id: "vo_1",
      orderId: "ord_1",
      vendorId: "vendor_1",
      routingStatus: "confirmed",
      fulfillmentStatus: "ready",
      squareOrderId: "sq_1",
      lastSquarePayload: null,
    });

    const result = await applySquareOrderStatusSync({
      vendorOrderId: "vo_1",
      applySource: "webhook",
    });

    expect(result.outcome).toBe("noop_same_status");
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });
});
