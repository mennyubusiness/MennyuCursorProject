import { describe, expect, it } from "vitest";
import {
  ORDER_PENDING_PAYMENT_STUCK_MINUTES,
  VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES,
  VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES,
  VENDOR_READY_STUCK_MINUTES,
} from "@/lib/admin-health-thresholds";

describe("admin health thresholds", () => {
  it("exports sprint 3 stuck-order thresholds", () => {
    expect(ORDER_PENDING_PAYMENT_STUCK_MINUTES).toBe(10);
    expect(VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES).toBe(10);
    expect(VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES).toBe(45);
    expect(VENDOR_READY_STUCK_MINUTES).toBe(120);
  });
});
