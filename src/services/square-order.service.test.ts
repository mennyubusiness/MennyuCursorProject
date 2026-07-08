import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockGetVendorOrder = vi.fn();
const mockAssertReady = vi.fn();
const mockGetConnection = vi.fn();
const mockEnsureToken = vi.fn();
const mockMap = vi.fn();
const mockCreateOrder = vi.fn();
const mockCreatePayment = vi.fn();
const mockUpsertMapping = vi.fn();
const mockGetIssues = vi.fn();
const mockCreateIssue = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { SQUARE_ROUTING_LIVE: "true" },
}));

vi.mock("@/lib/integrations/square/square-order-mapper", () => ({
  getVendorOrderForSquare: (...args: unknown[]) => mockGetVendorOrder(...args),
  mapVendorOrderToSquareCreateOrder: (...args: unknown[]) => mockMap(...args),
}));

vi.mock("@/lib/integrations/square/square-order-routing-readiness", () => ({
  assertSquareOrderRoutingReady: (...args: unknown[]) => mockAssertReady(...args),
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockGetConnection(...args),
  ensureSquareAccessToken: (...args: unknown[]) => mockEnsureToken(...args),
}));

vi.mock("@/lib/integrations/square/square-api.client", () => ({
  createSquareOrder: (...args: unknown[]) => mockCreateOrder(...args),
  createSquareExternalPayment: (...args: unknown[]) => mockCreatePayment(...args),
  SquareApiError: class SquareApiError extends Error {
    status = 400;
    body = {};
    constructor(message: string) {
      super(message);
      this.name = "SquareApiError";
    }
  },
}));

vi.mock("@/lib/integrations/provider-mapping.service", () => ({
  upsertProviderEntityMapping: (...args: unknown[]) => mockUpsertMapping(...args),
  hashProviderPayload: () => "hash",
}));

vi.mock("@/services/issues.service", () => ({
  getVendorOrderIssues: (...args: unknown[]) => mockGetIssues(...args),
  createVendorOrderIssue: (...args: unknown[]) => mockCreateIssue(...args),
}));

import { submitVendorOrderToSquare } from "@/services/square-order.service";

const VO_ID = "vo_sq_1";

describe("submitVendorOrderToSquare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVendorOrder.mockResolvedValue({ id: VO_ID, vendorId: "vendor_1" });
    mockFindUnique.mockResolvedValue({ routingStatus: "pending", squareOrderId: null });
    mockAssertReady.mockResolvedValue({ ok: true, locationId: "LOC_1" });
    mockGetConnection.mockResolvedValue({ id: "conn_1", accessTokenRef: "ref_1" });
    mockEnsureToken.mockResolvedValue("oauth_token_vendor");
    mockMap.mockResolvedValue({
      ok: true,
      request: {
        idempotency_key: `oo:sq:order:${VO_ID}`,
        order: { location_id: "LOC_1", line_items: [] },
      },
      lineItemCount: 1,
      modifierCount: 0,
    });
    mockCreateOrder.mockResolvedValue({
      order: { id: "sq_ord_abc", total_money: { amount: 1200, currency: "USD" } },
    });
    mockCreatePayment.mockResolvedValue({ payment: { id: "pay_1" } });
    mockUpdate.mockResolvedValue({});
    mockGetIssues.mockResolvedValue([]);
    mockCreateIssue.mockResolvedValue({});
    mockUpsertMapping.mockResolvedValue({});
  });

  it("returns existing Square order id without duplicate API calls", async () => {
    mockFindUnique.mockResolvedValue({ routingStatus: "sent", squareOrderId: "sq_existing" });

    const result = await submitVendorOrderToSquare(VO_ID, {
      customerPhone: "+1555",
      customerEmail: null,
    });

    expect(result).toEqual({ success: true, squareOrderId: "sq_existing" });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("uses vendor OAuth token and idempotency keys for order + external payment", async () => {
    const result = await submitVendorOrderToSquare(VO_ID, {
      customerPhone: "+1555",
      customerEmail: "guest@example.com",
    });

    expect(result.success).toBe(true);
    expect(mockEnsureToken).toHaveBeenCalled();
    expect(mockCreateOrder).toHaveBeenCalledWith(
      "oauth_token_vendor",
      expect.objectContaining({ idempotency_key: `oo:sq:order:${VO_ID}` })
    );
    expect(mockCreatePayment).toHaveBeenCalledWith(
      "oauth_token_vendor",
      expect.objectContaining({
        idempotency_key: `oo:sq:pay:${VO_ID}`,
        source_id: "EXTERNAL",
        order_id: "sq_ord_abc",
        external_details: { type: "OTHER", source: "Open Order" },
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VO_ID },
        data: expect.objectContaining({
          squareOrderId: "sq_ord_abc",
          routingStatus: "sent",
        }),
      })
    );
  });

  it("records routing failure and issue when Square API fails", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ routingStatus: "pending", squareOrderId: null })
      .mockResolvedValueOnce({ routingStatus: "pending", squareAttempts: 0 });
    mockCreateOrder.mockRejectedValue(new Error("Square 503"));

    const result = await submitVendorOrderToSquare(VO_ID, {
      customerPhone: "+1555",
      customerEmail: null,
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routingStatus: "failed",
          squareLastError: "Square 503",
        }),
      })
    );
    expect(mockCreateIssue).toHaveBeenCalledWith(
      VO_ID,
      "routing_failure",
      "HIGH",
      expect.objectContaining({ notes: "Square 503" })
    );
  });
});
