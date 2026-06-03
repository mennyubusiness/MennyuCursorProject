import { describe, expect, it } from "vitest";
import {
  formatAdminRefundBlockingReason,
  formatAdminRefundCapErrorMessage,
} from "./admin-refund-error-messages";

describe("admin-refund-error-messages", () => {
  it("maps cap error codes to friendly admin copy", () => {
    expect(
      formatAdminRefundCapErrorMessage({ code: "ORDER_ALREADY_FULLY_REFUNDED" })
    ).toBe("This order has already been fully refunded.");
    expect(formatAdminRefundCapErrorMessage({ code: "REFUND_IN_PROGRESS" })).toBe(
      "A refund for this order is already in progress. Refresh the order before trying again."
    );
    expect(
      formatAdminRefundCapErrorMessage({ code: "REFUND_AVAILABILITY_CHANGED" })
    ).toBe("Refund availability changed since preview. Preview the refund again.");
  });

  it("does not expose raw REFUND_EXCEEDS_ORDER_REMAINING in primary copy", () => {
    const message = formatAdminRefundCapErrorMessage({
      code: "REFUND_EXCEEDS_ORDER_REMAINING",
      message: "REFUND_EXCEEDS_ORDER_REMAINING: remaining=0, requested=2408",
    });
    expect(message).not.toContain("remaining=0");
    expect(message).toContain("Preview the refund again");
  });

  it("formats blocking reasons for admin UI", () => {
    expect(formatAdminRefundBlockingReason("refund_already_in_progress")).toContain(
      "already in progress"
    );
    expect(formatAdminRefundBlockingReason("order_already_fully_refunded")).toContain(
      "fully refunded"
    );
    expect(formatAdminRefundBlockingReason("stale_refund_attempt_blocks_refund")).toContain(
      "Dismiss the stale attempt"
    );
  });
});
