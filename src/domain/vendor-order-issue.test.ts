import { describe, expect, it } from "vitest";
import { vendorVisibleCustomerRefundStatus } from "./vendor-order-issue";

describe("vendor-order-issue domain", () => {
  it("vendorVisibleCustomerRefundStatus hides stripe details", () => {
    expect(vendorVisibleCustomerRefundStatus("succeeded")).toBe("Customer refunded");
    expect(vendorVisibleCustomerRefundStatus("pending")).toBe("Customer refund in progress");
    expect(vendorVisibleCustomerRefundStatus(null)).toBeNull();
  });
});
