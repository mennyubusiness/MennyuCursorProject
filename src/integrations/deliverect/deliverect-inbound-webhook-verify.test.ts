import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetKnownDeliverectChannelLink = vi.fn();
const mockEnrichPrepTime = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    DELIVERECT_WEBHOOK_AUTH_MODE: "channel_link",
    DELIVERECT_WEBHOOK_SECRET: undefined,
    NODE_ENV: "production",
  },
}));

vi.mock("@/services/deliverect-known-channel-link.service", () => ({
  getKnownDeliverectChannelLink: (...args: unknown[]) => mockGetKnownDeliverectChannelLink(...args),
}));

vi.mock("@/services/deliverect-prep-time-webhook.service", () => ({
  enrichPrepTimePayloadForWebhookVerification: (...args: unknown[]) => mockEnrichPrepTime(...args),
}));

import { verifyDeliverectInboundWebhookJson } from "./deliverect-inbound-webhook-verify";

const KNOWN_CHANNEL = "channel-link-known-123";
const UNKNOWN_CHANNEL = "channel-link-unknown-999";

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function postRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature) headers["x-deliverect-hmacsha256"] = signature;
  return new NextRequest("http://localhost/api/webhooks/deliverect", {
    method: "POST",
    headers,
    body,
  });
}

describe("verifyDeliverectInboundWebhookJson (channel_link mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrichPrepTime.mockImplementation(async (parsed: Record<string, unknown>) => parsed);
    mockGetKnownDeliverectChannelLink.mockImplementation(async (id: string) => {
      if (id === KNOWN_CHANNEL) {
        return { vendorId: "vendor_1", channelLinkId: KNOWN_CHANNEL, isActive: true };
      }
      if (id === "inactive-link") {
        return { vendorId: "vendor_2", channelLinkId: "inactive-link", isActive: false };
      }
      return null;
    });
  });

  it("passes for known channelLinkId with valid signature", async () => {
    const body = JSON.stringify({ channelLinkId: KNOWN_CHANNEL, status: 20 });
    const req = postRequest(body, signBody(body, KNOWN_CHANNEL));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.channelLinkId).toBe(KNOWN_CHANNEL);
      expect(result.vendorId).toBe("vendor_1");
    }
  });

  it("rejects unknown channelLinkId even with valid self-computed signature", async () => {
    const body = JSON.stringify({ channelLinkId: UNKNOWN_CHANNEL, status: 20 });
    const req = postRequest(body, signBody(body, UNKNOWN_CHANNEL));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unknown_channel_link");
      expect(result.response.status).toBe(403);
    }
  });

  it("rejects invalid signature for known channelLinkId", async () => {
    const body = JSON.stringify({ channelLinkId: KNOWN_CHANNEL, status: 20 });
    const req = postRequest(body, signBody(body, "wrong-secret"));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad_signature");
      expect(result.response.status).toBe(401);
    }
  });

  it("rejects missing channelLinkId", async () => {
    const body = JSON.stringify({ status: 20 });
    const req = postRequest(body, signBody(body, KNOWN_CHANNEL));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_channel_link_id");
  });

  it("rejects missing signature", async () => {
    const body = JSON.stringify({ channelLinkId: KNOWN_CHANNEL });
    const req = postRequest(body);
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_signature");
  });

  it("rejects inactive known channel link", async () => {
    const body = JSON.stringify({ channelLinkId: "inactive-link" });
    const req = postRequest(body, signBody(body, "inactive-link"));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inactive_channel_link");
      expect(result.response.status).toBe(403);
    }
  });

  it("allows channel-registration without known channel lookup when configured", async () => {
    const body = JSON.stringify({ channelLinkId: UNKNOWN_CHANNEL });
    const req = postRequest(body, signBody(body, UNKNOWN_CHANNEL));
    const result = await verifyDeliverectInboundWebhookJson(req, body, undefined, {
      requireKnownChannelLink: false,
    });
    expect(result.ok).toBe(true);
    expect(mockGetKnownDeliverectChannelLink).not.toHaveBeenCalled();
  });
});

describe("verifyDeliverectInboundWebhookJson (partner_secret mode)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const envModule = await import("@/lib/env");
    (envModule.env as { DELIVERECT_WEBHOOK_AUTH_MODE: string }).DELIVERECT_WEBHOOK_AUTH_MODE =
      "partner_secret";
    (envModule.env as { DELIVERECT_WEBHOOK_SECRET?: string }).DELIVERECT_WEBHOOK_SECRET =
      "global-partner-secret";
  });

  it("verifies with global secret without known channel lookup", async () => {
    const body = JSON.stringify({ channelLinkId: UNKNOWN_CHANNEL });
    const req = postRequest(body, signBody(body, "global-partner-secret"));
    const result = await verifyDeliverectInboundWebhookJson(req, body);
    expect(result.ok).toBe(true);
    expect(mockGetKnownDeliverectChannelLink).not.toHaveBeenCalled();
  });
});
