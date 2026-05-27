import { describe, expect, it } from "vitest";
import {
  formatAdminMoney,
  refundScopeLabel,
  refundStatusLabel,
} from "./admin-refund-ui";

describe("admin-refund-ui", () => {
  it("formatAdminMoney formats cents", () => {
    expect(formatAdminMoney(1999)).toBe("$19.99");
  });

  it("refundStatusLabel maps known statuses", () => {
    expect(refundStatusLabel("succeeded")).toBe("Customer refunded");
    expect(refundStatusLabel("failed")).toBe("Refund failed");
  });

  it("refundScopeLabel maps scopes", () => {
    expect(refundScopeLabel("full_order")).toBe("Full order");
    expect(refundScopeLabel("custom_vendor_partial")).toContain("partial");
  });
});
