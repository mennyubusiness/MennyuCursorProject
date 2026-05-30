import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssertCustomerOrderAccess = vi.fn();
const mockApplyVendorOrderTransition = vi.fn();
const mockNotifyDeliverectOfCustomerCancellation = vi.fn();
const mockRunAutomaticRefundForDecision = vi.fn();
const mockClearCheckoutSourceCartForOrder = vi.fn();

vi.mock("@/lib/customer-order-access", () => ({
  assertCustomerOrderAccess: (...args: unknown[]) => mockAssertCustomerOrderAccess(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  applyVendorOrderTransition: (...args: unknown[]) => mockApplyVendorOrderTransition(...args),
}));

vi.mock("@/services/deliverect-customer-cancel.service", () => ({
  notifyDeliverectOfCustomerCancellation: (...args: unknown[]) =>
    mockNotifyDeliverectOfCustomerCancellation(...args),
}));

vi.mock("@/lib/refund-route-helpers", () => ({
  runAutomaticRefundForDecision: (...args: unknown[]) => mockRunAutomaticRefundForDecision(...args),
}));

vi.mock("@/services/cart.service", () => ({
  clearCheckoutSourceCartForOrder: (...args: unknown[]) =>
    mockClearCheckoutSourceCartForOrder(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { POST as postWholeOrderCancel } from "./cancel/route";
import { POST as postVendorOrderCancel } from "./vendor-orders/[vendorOrderId]/cancel/route";
import {
  CUSTOMER_CANCEL_UNSUPPORTED_CODE,
  CUSTOMER_CANCEL_UNSUPPORTED_MESSAGE,
} from "@/lib/customer-cancel-api";

const issuesRouteSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "issues/route.ts"),
  "utf8"
);
const orderSupportIssueDomainSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../domain/order-support-issue.ts"),
  "utf8"
);

const ORDER_ID = "ord_cancel_lockdown";
const VENDOR_ORDER_ID = "vo_cancel_lockdown";

describe("legacy customer cancel APIs disabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      customerPhone: "+15551234567",
    });
  });

  it("whole-order cancel returns 410 CUSTOMER_CANCEL_UNSUPPORTED for authorized customer", async () => {
    const res = await postWholeOrderCancel(new Request("http://localhost/cancel", { method: "POST" }), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe(CUSTOMER_CANCEL_UNSUPPORTED_CODE);
    expect(body.error).toBe(CUSTOMER_CANCEL_UNSUPPORTED_MESSAGE);
    expect(body.error).toMatch(/Need help with this order/i);
    expect(mockApplyVendorOrderTransition).not.toHaveBeenCalled();
    expect(mockNotifyDeliverectOfCustomerCancellation).not.toHaveBeenCalled();
    expect(mockRunAutomaticRefundForDecision).not.toHaveBeenCalled();
    expect(mockClearCheckoutSourceCartForOrder).not.toHaveBeenCalled();
  });

  it("vendor-order cancel returns 410 CUSTOMER_CANCEL_UNSUPPORTED for authorized customer", async () => {
    const res = await postVendorOrderCancel(new Request("http://localhost/cancel", { method: "POST" }), {
      params: Promise.resolve({ orderId: ORDER_ID, vendorOrderId: VENDOR_ORDER_ID }),
    });

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe(CUSTOMER_CANCEL_UNSUPPORTED_CODE);
    expect(body.error).toBe(CUSTOMER_CANCEL_UNSUPPORTED_MESSAGE);
    expect(mockApplyVendorOrderTransition).not.toHaveBeenCalled();
    expect(mockNotifyDeliverectOfCustomerCancellation).not.toHaveBeenCalled();
    expect(mockRunAutomaticRefundForDecision).not.toHaveBeenCalled();
    expect(mockClearCheckoutSourceCartForOrder).not.toHaveBeenCalled();
  });

  it("returns auth error before unsupported response when access denied", async () => {
    mockAssertCustomerOrderAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Customer identity required.",
    });

    const res = await postWholeOrderCancel(new Request("http://localhost/cancel", { method: "POST" }), {
      params: Promise.resolve({ orderId: ORDER_ID }),
    });

    expect(res.status).toBe(401);
    expect(mockApplyVendorOrderTransition).not.toHaveBeenCalled();
  });

  it("uses assertCustomerOrderAccess instead of phone-cookie-only auth", async () => {
    await postVendorOrderCancel(new Request("http://localhost/cancel", { method: "POST" }), {
      params: Promise.resolve({ orderId: ORDER_ID, vendorOrderId: VENDOR_ORDER_ID }),
    });

    expect(mockAssertCustomerOrderAccess).toHaveBeenCalledWith(ORDER_ID, expect.any(Headers));
  });
});

describe("cancel_request support issue flow", () => {
  it("issues route still accepts cancel_request via assertCustomerOrderAccess", () => {
    expect(orderSupportIssueDomainSrc).toMatch(/cancel_request/);
    expect(issuesRouteSrc).toMatch(/CUSTOMER_SUPPORT_ISSUE_TYPES/);
    expect(issuesRouteSrc).toMatch(/assertCustomerOrderAccess/);
    expect(issuesRouteSrc).toMatch(/createCustomerSupportIssue/);
  });
});
