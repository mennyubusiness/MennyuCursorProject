import { describe, expect, it } from "vitest";
import {
  customerSupportIssueSubmitSuccessMessage,
  customerSupportIssueTypeLabel,
  customerSupportIssueStatusMessage,
  isActiveOrderIssueStatus,
  isCustomerReportedOrderIssue,
} from "./order-support-issue";

describe("order-support-issue domain", () => {
  it("labels cancellation help reason for customers", () => {
    expect(customerSupportIssueTypeLabel("cancel_request")).toBe("I need to cancel my order");
  });

  it("returns cancellation-specific submit success copy", () => {
    expect(customerSupportIssueSubmitSuccessMessage("cancel_request")).toMatch(/isn't guaranteed/i);
    expect(customerSupportIssueSubmitSuccessMessage("missing_item")).toContain("received your issue");
  });

  it("customer status copy is safe", () => {
    expect(customerSupportIssueStatusMessage("open")).toBe("We received your issue.");
    expect(customerSupportIssueStatusMessage("reviewing")).toContain("reviewing");
    expect(customerSupportIssueStatusMessage("dismissed")).not.toMatch(/stripe|reversal/i);
  });

  it("treats legacy OPEN as active", () => {
    expect(isActiveOrderIssueStatus("OPEN")).toBe(true);
    expect(isActiveOrderIssueStatus("resolved")).toBe(false);
  });

  it("identifies customer-reported issues for SMS eligibility", () => {
    expect(isCustomerReportedOrderIssue("customer")).toBe(true);
    expect(isCustomerReportedOrderIssue("system")).toBe(false);
    expect(isCustomerReportedOrderIssue("admin")).toBe(false);
  });
});
