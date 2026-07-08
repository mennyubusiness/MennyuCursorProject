import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockSubmitDeliverect = vi.fn();
const mockSubmitSquare = vi.fn();
const mockApplyStatus = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/services/deliverect.service", () => ({
  submitVendorOrderToDeliverect: (...args: unknown[]) => mockSubmitDeliverect(...args),
}));

vi.mock("@/services/square-order.service", () => ({
  submitVendorOrderToSquare: (...args: unknown[]) => mockSubmitSquare(...args),
}));

vi.mock("@/services/vendor-order-status-instrumentation", () => ({
  applyVendorOrderStatusWithMeta: (...args: unknown[]) => mockApplyStatus(...args),
}));

import { retryVendorOrderRouting, submitVendorOrder } from "./routing.service";

const VO_ID = "vo_routing_test";
const ORDER_ID = "ord_routing_test";
const PHONE = "+15551234567";
const EMAIL = "guest@example.com";

const baseContext = {
  customerPhone: PHONE,
  customerEmail: EMAIL,
  preparationTimeMinutes: 20,
};

function routingHead(opts?: {
  voChannelLink?: string | null;
  vendorChannelLink?: string | null;
  orderRoutingMode?: "manual_dashboard" | "deliverect" | "square";
  squareOrderRoutingEnabled?: boolean;
  busyDelay?: number;
}) {
  return {
    deliverectChannelLinkId: opts?.voChannelLink ?? null,
    vendor: {
      orderRoutingMode: opts?.orderRoutingMode ?? "deliverect",
      squareOrderRoutingEnabled: opts?.squareOrderRoutingEnabled ?? false,
      deliverectChannelLinkId:
        opts?.vendorChannelLink === undefined ? "ch_deliverect_test" : opts.vendorChannelLink,
      deliverectBusyDelayMinutes: opts?.busyDelay ?? 0,
    },
  };
}

describe("submitVendorOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockApplyStatus.mockResolvedValue("routing");
    mockUpdate.mockResolvedValue({});
  });

  it("returns not found when vendor order is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({ success: false, error: "Vendor order not found" });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
    expect(mockSubmitSquare).not.toHaveBeenCalled();
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });

  it("uses manual path when routing mode is manual_dashboard", async () => {
    mockFindUnique
      .mockResolvedValueOnce(
        routingHead({ orderRoutingMode: "manual_dashboard", vendorChannelLink: "ch_deliverect_test" })
      )
      .mockResolvedValueOnce({
        orderId: ORDER_ID,
        fulfillmentStatus: "pending",
        statusAuthority: null,
      });

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({ success: true, skipped: true });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
    expect(mockSubmitSquare).not.toHaveBeenCalled();
    expect(mockApplyStatus).toHaveBeenCalled();
  });

  it("fails when square routing mode is not enabled", async () => {
    mockFindUnique.mockResolvedValueOnce(
      routingHead({ orderRoutingMode: "square", squareOrderRoutingEnabled: false })
    );

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({
      success: false,
      error: "Square order routing is not enabled for this vendor.",
      code: "SQUARE_ROUTING_DISABLED",
    });
    expect(mockSubmitSquare).not.toHaveBeenCalled();
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
  });

  it("routes square-enabled vendors through Square submit path", async () => {
    mockFindUnique.mockResolvedValueOnce(
      routingHead({ orderRoutingMode: "square", squareOrderRoutingEnabled: true })
    );
    mockSubmitSquare.mockResolvedValue({ success: true, squareOrderId: "sq_ord_1" });

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(mockSubmitSquare).toHaveBeenCalledWith(VO_ID, {
      customerPhone: PHONE,
      customerEmail: EMAIL,
    });
    expect(result).toEqual({
      success: true,
      externalOrderId: "sq_ord_1",
    });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
  });

  it("fails deliverect routing when mode is deliverect but channel link is missing", async () => {
    mockFindUnique.mockResolvedValueOnce(
      routingHead({ orderRoutingMode: "deliverect", vendorChannelLink: null })
    );

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({
      success: false,
      error: "Deliverect routing is configured but channel link is missing.",
      code: "DELIVERECT_NOT_CONFIGURED",
    });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
  });

  it("routes Deliverect-linked vendor through Deliverect submit path", async () => {
    mockFindUnique
      .mockResolvedValueOnce(routingHead())
      .mockResolvedValueOnce({ statusAuthority: null });
    mockSubmitDeliverect.mockResolvedValue({
      success: true,
      deliverectOrderId: "dlv_ord_1",
    });

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(mockSubmitDeliverect).toHaveBeenCalledWith(VO_ID, PHONE, EMAIL, 20);
    expect(result).toEqual({
      success: true,
      externalOrderId: "dlv_ord_1",
    });
  });
});

describe("retryVendorOrderRouting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockSubmitDeliverect.mockResolvedValue({ success: true, deliverectOrderId: "dlv_retry" });
    mockUpdate.mockResolvedValue({});
  });

  it("reloads order context and reuses submitVendorOrder", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: VO_ID,
        order: { customerPhone: PHONE, customerEmail: EMAIL },
      })
      .mockResolvedValueOnce(routingHead())
      .mockResolvedValueOnce({ statusAuthority: null });

    const result = await retryVendorOrderRouting(VO_ID);

    expect(result.success).toBe(true);
    expect(mockSubmitDeliverect).toHaveBeenCalledWith(VO_ID, PHONE, EMAIL, 15);
  });
});
