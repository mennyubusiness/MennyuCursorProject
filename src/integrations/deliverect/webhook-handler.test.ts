import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  extractDeliverectExternalOrderId,
  flattenDeliverectWebhookPayload,
  getDeliverectEventId,
  resolveMennyuVendorOrderId,
  verifyDeliverectSignature,
} from "./webhook-handler";
import type { DeliverectWebhookPayload } from "./payloads";

describe("verifyDeliverectSignature", () => {
  const body = '{"orderId":"x"}';
  const secret = "test-secret";
  const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");

  it("accepts valid hex signature", () => {
    expect(verifyDeliverectSignature(body, sig, secret, { nodeEnv: "production", allowUnsignedDev: false })).toBe(
      true
    );
  });

  it("accepts sha256= prefix form", () => {
    expect(
      verifyDeliverectSignature(body, `sha256=${sig}`, secret, { nodeEnv: "production", allowUnsignedDev: false })
    ).toBe(true);
  });

  it("rejects wrong secret", () => {
    expect(
      verifyDeliverectSignature(body, sig, "other", { nodeEnv: "production", allowUnsignedDev: false })
    ).toBe(false);
  });

  it("rejects missing signature when secret configured", () => {
    expect(verifyDeliverectSignature(body, null, secret, { nodeEnv: "production", allowUnsignedDev: false })).toBe(
      false
    );
  });
});

describe("resolveMennyuVendorOrderId", () => {
  it("prefers mennyu cuid-shaped channelOrderId", () => {
    const id = "c" + "a".repeat(24);
    expect(resolveMennyuVendorOrderId({ channelOrderId: id })).toBe(id);
  });

  it("ignores long non-cuid orderId for VO resolution", () => {
    expect(resolveMennyuVendorOrderId({ orderId: "507f1f77bcf86cd799439011" })).toBe(null);
  });
});

describe("extractDeliverectExternalOrderId", () => {
  it("returns mongo-like id and skips cuid", () => {
    const cuid = "c" + "a".repeat(24);
    expect(
      extractDeliverectExternalOrderId({
        _id: cuid,
        oid: "507f1f77bcf86cd799439011",
      })
    ).toBe("507f1f77bcf86cd799439011");
  });
});

describe("getDeliverectEventId", () => {
  it("uses message id when present", () => {
    const payload = { webhookId: "msg-1" } as DeliverectWebhookPayload;
    const flat = flattenDeliverectWebhookPayload(payload);
    expect(getDeliverectEventId(payload, flat, "{}")).toBe("deliverect:msg:msg-1");
  });

  it("composes composite id when ext + status + time present", () => {
    const payload = {} as DeliverectWebhookPayload;
    const flat = {
      oid: "507f1f77bcf86cd799439011",
      status: 20,
      updatedAt: "2020-01-01T00:00:00Z",
    };
    expect(getDeliverectEventId(payload, flat, "{}")).toContain("deliverect:ext:507f1f77bcf86cd799439011:20:");
  });
});
