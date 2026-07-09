import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";

import {
  isSquareWebhookSignatureConfigured,
  resolveSquareWebhookNotificationUrl,
  verifySquareWebhookSignature,
} from "@/lib/integrations/square/square-webhook-verify";

vi.mock("@/lib/env", () => ({
  env: {
    SQUARE_WEBHOOK_SIGNATURE_KEY: "test-signature-key",
    SQUARE_WEBHOOK_NOTIFICATION_URL: "https://www.openorderco.com/api/webhooks/square",
    PUBLIC_APP_URL: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  },
}));

function sign(body: string, url: string, key: string): string {
  return createHmac("sha256", key).update(`${url}${body}`).digest("base64");
}

describe("verifySquareWebhookSignature", () => {
  const url = "https://www.openorderco.com/api/webhooks/square";
  const body = '{"type":"order.updated","event_id":"evt_1"}';

  it("accepts valid signatures", () => {
    const signature = sign(body, url, "test-signature-key");
    expect(
      verifySquareWebhookSignature({
        rawBody: body,
        signatureHeader: signature,
        notificationUrl: url,
      })
    ).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(
      verifySquareWebhookSignature({
        rawBody: body,
        signatureHeader: "bad-signature",
        notificationUrl: url,
      })
    ).toBe(false);
  });
});

describe("isSquareWebhookSignatureConfigured", () => {
  it("returns true when key is set", () => {
    expect(isSquareWebhookSignatureConfigured()).toBe(true);
  });
});

describe("resolveSquareWebhookNotificationUrl", () => {
  it("uses explicit env URL", () => {
    expect(resolveSquareWebhookNotificationUrl()).toBe(
      "https://www.openorderco.com/api/webhooks/square"
    );
  });
});
