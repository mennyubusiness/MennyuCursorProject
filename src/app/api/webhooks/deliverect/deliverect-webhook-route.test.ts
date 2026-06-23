import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockVerify = vi.fn();
const mockPersistRejection = vi.fn();
const mockWebhookFindUnique = vi.fn();
const mockWebhookCreate = vi.fn();
const mockWebhookUpdateMany = vi.fn();
const mockVendorOrderFindUnique = vi.fn();
const mockVendorOrderFindFirst = vi.fn();
const mockApplyWebhook = vi.fn();

vi.mock("@/integrations/deliverect/deliverect-inbound-webhook-verify", () => ({
  verifyDeliverectInboundWebhookJson: (...args: unknown[]) => mockVerify(...args),
}));

vi.mock("./verification-audit", () => ({
  persistDeliverectOrderWebhookRejection: (...args: unknown[]) => mockPersistRejection(...args),
}));

vi.mock("@/services/order-status.service", () => ({
  applyDeliverectStatusWebhook: (...args: unknown[]) => mockApplyWebhook(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: {
      findUnique: (...args: unknown[]) => mockWebhookFindUnique(...args),
      create: (...args: unknown[]) => mockWebhookCreate(...args),
      updateMany: (...args: unknown[]) => mockWebhookUpdateMany(...args),
    },
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockVendorOrderFindUnique(...args),
      findFirst: (...args: unknown[]) => mockVendorOrderFindFirst(...args),
    },
  },
}));

import { POST } from "./route";

const CHANNEL = "channel-link-known-123";
const VO_ID = `c${"a".repeat(24)}`;
const DLV_ORDER_ID = "507f1f77bcf86cd799439011";
const EVENT_ID = "deliverect:msg:evt_status_20";

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function statusWebhookBody(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    channelLinkId: CHANNEL,
    channelOrderId: VO_ID,
    oid: DLV_ORDER_ID,
    webhookId: "evt_status_20",
    status: 20,
    orderStatus: 20,
    ...overrides,
  });
}

function deliverectRequest(body: string, signature?: string): NextRequest {
  const sig = signature ?? signBody(body, CHANNEL);
  return new NextRequest("http://localhost/api/webhooks/deliverect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-deliverect-hmacsha256": sig,
    },
    body,
  });
}

function verifyOk(body: string) {
  const parsed = JSON.parse(body) as Record<string, unknown>;
  mockVerify.mockResolvedValue({
    ok: true,
    parsed,
    authMode: "channel_link",
    channelLinkId: CHANNEL,
    vendorId: "vendor_1",
  });
}

describe("POST /api/webhooks/deliverect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistRejection.mockResolvedValue(undefined);
    mockWebhookCreate.mockResolvedValue({ id: "we_1" });
    mockWebhookUpdateMany.mockResolvedValue({ count: 1 });
    mockApplyWebhook.mockResolvedValue({
      outcome: "applied",
      orderId: "ord_1",
      vendorOrderId: VO_ID,
      updatedVendorOrderState: true,
    });
  });

  it("applies valid status webhook to the resolved vendor order", async () => {
    const body = statusWebhookBody();
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue(null);
    mockVendorOrderFindUnique.mockResolvedValue({ id: VO_ID });

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      received: true,
      resolved: true,
      outcome: "applied",
      vendorOrderId: VO_ID,
    });
    expect(mockApplyWebhook).toHaveBeenCalledWith(
      VO_ID,
      DLV_ORDER_ID,
      expect.objectContaining({ status: 20 })
    );
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      })
    );
  });

  it("rejects invalid HMAC without applying status", async () => {
    const body = statusWebhookBody();
    mockVerify.mockResolvedValue({
      ok: false,
      reason: "bad_signature",
      response: NextResponse.json({ error: "Invalid signature", code: "bad_signature" }, { status: 401 }),
    });

    const res = await POST(deliverectRequest(body, signBody(body, "wrong-secret")));

    expect(res.status).toBe(401);
    expect(mockPersistRejection).toHaveBeenCalledWith(body, "bad_signature");
    expect(mockApplyWebhook).not.toHaveBeenCalled();
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain(CHANNEL);
  });

  it("returns unmapped outcome for unknown numeric status without crashing", async () => {
    const body = statusWebhookBody({ status: 9999, orderStatus: 9999, webhookId: "evt_unknown" });
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue(null);
    mockVendorOrderFindUnique.mockResolvedValue({ id: VO_ID });
    mockApplyWebhook.mockResolvedValue({
      outcome: "unmapped_status",
      orderId: "ord_1",
      vendorOrderId: VO_ID,
      updatedVendorOrderState: false,
    });

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.outcome).toBe("unmapped_status");
    expect(json.resolved).toBe(true);
  });

  it("returns match_failed when vendor order cannot be resolved", async () => {
    const body = statusWebhookBody({
      channelOrderId: "c" + "z".repeat(24),
      oid: "unknown_external",
    });
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue(null);
    mockVendorOrderFindUnique.mockResolvedValue(null);
    mockVendorOrderFindFirst.mockResolvedValue(null);

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ received: true, resolved: false, outcome: "match_failed" });
    expect(mockApplyWebhook).not.toHaveBeenCalled();
  });

  it("ignores duplicate webhook delivery idempotently", async () => {
    const body = statusWebhookBody();
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue({
      id: "we_dup",
      processed: true,
      eventId: EVENT_ID,
      errorMessage: null,
    });

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ duplicate: true, outcome: "duplicate" });
    expect(mockApplyWebhook).not.toHaveBeenCalled();
    expect(mockWebhookCreate).not.toHaveBeenCalled();
  });

  it("surfaces ignored_backward outcome for out-of-order webhook without error", async () => {
    const body = statusWebhookBody({ status: 20, webhookId: "evt_backward" });
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue(null);
    mockVendorOrderFindUnique.mockResolvedValue({ id: VO_ID });
    mockApplyWebhook.mockResolvedValue({
      outcome: "ignored_backward",
      orderId: "ord_1",
      vendorOrderId: VO_ID,
      updatedVendorOrderState: false,
    });

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.outcome).toBe("ignored_backward");
    expect(json.updatedVendorOrderState).toBe(false);
  });

  it("maps POS accepted, preparing, ready, and completed statuses through apply pipeline", async () => {
    for (const [code, outcome] of [
      [20, "applied"],
      [50, "applied"],
      [70, "applied"],
      [90, "applied"],
    ] as const) {
      vi.clearAllMocks();
      const body = statusWebhookBody({ status: code, orderStatus: code, webhookId: `evt_${code}` });
      verifyOk(body);
      mockWebhookFindUnique.mockResolvedValue(null);
      mockVendorOrderFindUnique.mockResolvedValue({ id: VO_ID });
      mockApplyWebhook.mockResolvedValue({
        outcome,
        orderId: "ord_1",
        vendorOrderId: VO_ID,
        updatedVendorOrderState: true,
      });

      const res = await POST(deliverectRequest(body));
      expect((await res.json()).outcome).toBe(outcome);
      expect(mockApplyWebhook).toHaveBeenCalledWith(
        VO_ID,
        expect.anything(),
        expect.objectContaining({ status: code })
      );
    }
  });

  it("returns 500 when apply throws without leaking secrets", async () => {
    const body = statusWebhookBody({ webhookId: "evt_apply_err" });
    verifyOk(body);
    mockWebhookFindUnique.mockResolvedValue(null);
    mockVendorOrderFindUnique.mockResolvedValue({ id: VO_ID });
    mockApplyWebhook.mockRejectedValue(new Error("database unavailable"));

    const res = await POST(deliverectRequest(body));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("database unavailable");
    expect(JSON.stringify(json)).not.toContain(CHANNEL);
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: false, errorMessage: "database unavailable" }),
      })
    );
  });
});
