import { createHmac } from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockLog = vi.fn();
const mockMark = vi.fn();
const mockSync = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    SQUARE_WEBHOOK_SIGNATURE_KEY: "test-key",
    SQUARE_WEBHOOK_NOTIFICATION_URL: "https://www.openorderco.com/api/webhooks/square",
    PUBLIC_APP_URL: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  },
}));

vi.mock("@/lib/integrations/provider-webhook-event.service", () => ({
  logProviderWebhookEvent: (...args: unknown[]) => mockLog(...args),
  markProviderWebhookEventProcessed: (...args: unknown[]) => mockMark(...args),
}));

vi.mock("@/services/square-status-sync.service", () => ({
  syncSquareOrderStatusBySquareOrderId: (...args: unknown[]) => mockSync(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    providerWebhookEvent: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { POST } from "@/app/api/webhooks/square/route";

const URL = "https://www.openorderco.com/api/webhooks/square";

function signedRequest(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const sig =
    signature ??
    createHmac("sha256", "test-key").update(`${URL}${raw}`).digest("base64");
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-square-hmacsha256-signature": sig,
    },
    body: raw,
  });
}

describe("POST /api/webhooks/square", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLog.mockResolvedValue({ created: true, id: "pwe_1" });
    mockMark.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it("rejects invalid signatures", async () => {
    const res = await POST(
      signedRequest({ type: "order.updated", event_id: "evt_1" }, "invalid")
    );
    expect(res.status).toBe(403);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("ignores duplicate event IDs", async () => {
    mockLog.mockResolvedValueOnce({
      created: false,
      id: "pwe_dup",
      reason: "duplicate_external_event_id",
    });
    const res = await POST(
      signedRequest({
        type: "order.updated",
        event_id: "evt_dup",
        data: { object: { order_updated: { order_id: "sq_1" } } },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("ignores non order.updated events", async () => {
    const res = await POST(
      signedRequest({ type: "payment.updated", event_id: "evt_pay" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome).toBe("ignored_non_order_update");
  });

  it("ignores when no matching vendor order", async () => {
    mockSync.mockResolvedValueOnce({ matched: false, outcome: "ignored_no_match" });
    const res = await POST(
      signedRequest({
        type: "order.updated",
        event_id: "evt_nomatch",
        data: { object: { order_updated: { order_id: "sq_missing" } } },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome).toBe("ignored_no_match");
  });

  it("processes matching order.updated events", async () => {
    mockSync.mockResolvedValueOnce({
      matched: true,
      outcome: "applied",
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      updatedVendorOrderState: true,
      detail: "Applied",
    });
    const res = await POST(
      signedRequest({
        type: "order.updated",
        event_id: "evt_ok",
        data: { object: { order_updated: { order_id: "sq_1" } } },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome).toBe("applied");
    expect(json.updated).toBe(true);
  });
});
