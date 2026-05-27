import { describe, expect, it } from "vitest";
import { refundDisplayMessage } from "./order-status-helpers";

describe("refundDisplayMessage", () => {
  it("uses ledger pending state over legacy succeeded", () => {
    const msg = refundDisplayMessage({
      orderRefunds: [
        { status: "pending", amountCents: 800, createdAt: new Date("2026-05-02T00:00:00Z") },
      ],
      refundAttempts: [
        { status: "succeeded", amountCents: 800, createdAt: new Date("2026-05-01T00:00:00Z") },
      ],
    });
    expect(msg?.line).toBe("Refund pending.");
  });

  it("does not mention transfer reversal", () => {
    const msg = refundDisplayMessage({
      orderRefunds: [{ status: "failed", amountCents: 800, createdAt: new Date() }],
    });
    expect(msg?.line).not.toMatch(/transfer|reversal|clawback/i);
  });
});
