import { describe, expect, it } from "vitest";
import {
  customerRefundDisplayMessage,
  isPartialRefundDisplay,
  pickLatestCustomerRefundDisplay,
} from "./customer-refund-display";

describe("customer-refund-display", () => {
  const t0 = new Date("2026-05-01T12:00:00Z");
  const t1 = new Date("2026-05-01T13:00:00Z");

  it("prefers latest ledger over older legacy attempt", () => {
    const latest = pickLatestCustomerRefundDisplay({
      orderRefunds: [{ status: "pending", amountCents: 500, createdAt: t1 }],
      refundAttempts: [{ status: "succeeded", amountCents: 500, createdAt: t0 }],
    });
    expect(latest?.source).toBe("ledger");
    expect(latest?.status).toBe("pending");
  });

  it("shows pending message without transfer internals", () => {
    const msg = customerRefundDisplayMessage({
      status: "pending",
      amountCents: 1200,
      createdAt: t1,
      source: "ledger",
    });
    expect(msg?.line).toBe("Refund pending.");
    expect(msg?.line).not.toMatch(/transfer|reversal|Stripe/i);
  });

  it("shows failed support message", () => {
    const msg = customerRefundDisplayMessage({
      status: "failed",
      amountCents: 1200,
      createdAt: t1,
      source: "ledger",
    });
    expect(msg?.line).toContain("reviewing");
  });

  it("detects partial refund display", () => {
    expect(isPartialRefundDisplay({ orderTotalCents: 1000, refundedCents: 400 })).toBe(true);
    expect(isPartialRefundDisplay({ orderTotalCents: 1000, refundedCents: 1000 })).toBe(false);
  });
});
