import { describe, expect, it } from "vitest";
import {
  customerSupportIssueStatusMessage,
  isActiveOrderIssueStatus,
} from "./order-support-issue";

describe("order-support-issue domain", () => {
  it("customer status copy is safe", () => {
    expect(customerSupportIssueStatusMessage("open")).toBe("We received your issue.");
    expect(customerSupportIssueStatusMessage("reviewing")).toContain("reviewing");
    expect(customerSupportIssueStatusMessage("dismissed")).not.toMatch(/stripe|reversal/i);
  });

  it("treats legacy OPEN as active", () => {
    expect(isActiveOrderIssueStatus("OPEN")).toBe(true);
    expect(isActiveOrderIssueStatus("resolved")).toBe(false);
  });
});
