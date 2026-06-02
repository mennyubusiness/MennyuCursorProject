import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSmsLogFindUnique = vi.fn();
const mockSmsLogCreate = vi.fn();
const mockSmsLogUpdate = vi.fn();
const mockSmsLogUpdateMany = vi.fn();
const mockSendTwilio = vi.fn();
const mockIsPhoneSmsOptedOut = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    smsMessageLog: {
      findUnique: (...args: unknown[]) => mockSmsLogFindUnique(...args),
      create: (...args: unknown[]) => mockSmsLogCreate(...args),
      update: (...args: unknown[]) => mockSmsLogUpdate(...args),
      updateMany: (...args: unknown[]) => mockSmsLogUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/twilio", () => ({
  sendTwilioMessage: (...args: unknown[]) => mockSendTwilio(...args),
}));

vi.mock("@/lib/sms-opt-out.service", () => ({
  isPhoneSmsOptedOut: (...args: unknown[]) => mockIsPhoneSmsOptedOut(...args),
}));

vi.mock("@/lib/sms-config", () => ({
  resolveSmsMode: vi.fn(() => "twilio"),
  shouldSendViaTwilio: vi.fn(() => true),
  smsOperationalError: vi.fn(() => null),
}));

import { resolveSmsMode, shouldSendViaTwilio } from "@/lib/sms-config";
import {
  sendOrderReadySms,
  sendOrderReceivedSms,
  sendSms,
  sendTransactionalSms,
  sendVerificationCodeSms,
} from "./sms.service";

describe("sms.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSmsLogFindUnique.mockResolvedValue(null);
    mockSmsLogCreate.mockResolvedValue({ id: "log_1" });
    mockSmsLogUpdate.mockResolvedValue({});
    mockSmsLogUpdateMany.mockResolvedValue({ count: 0 });
    mockSendTwilio.mockResolvedValue({ sid: "SM123", status: "queued" });
    mockIsPhoneSmsOptedOut.mockResolvedValue(false);
    vi.mocked(resolveSmsMode).mockReturnValue("twilio");
    vi.mocked(shouldSendViaTwilio).mockReturnValue(true);
  });

  it("SMS_MODE=log reserves once and does not call Twilio", async () => {
    vi.mocked(resolveSmsMode).mockReturnValue("log");
    vi.mocked(shouldSendViaTwilio).mockReturnValue(false);
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:ORDER_RECEIVED:ord_1",
    });
    expect(r.status).toBe("logged");
    expect(mockSendTwilio).not.toHaveBeenCalled();
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "logged",
          idempotencyKey: "sms:ORDER_RECEIVED:ord_1",
        }),
      })
    );
  });

  it("SMS_MODE=disabled suppresses without Twilio", async () => {
    vi.mocked(resolveSmsMode).mockReturnValue("disabled");
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:ORDER_RECEIVED:ord_1",
    });
    expect(r.status).toBe("skipped");
    expect(mockSendTwilio).not.toHaveBeenCalled();
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "skipped" }),
      })
    );
  });

  it("missing Twilio config logs instead of sending when mode is log", async () => {
    vi.mocked(resolveSmsMode).mockReturnValue("log");
    vi.mocked(shouldSendViaTwilio).mockReturnValue(false);
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("logged");
  });

  it("reserves pending before Twilio and finalizes with providerMessageId", async () => {
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:test:1",
    });
    expect(r.status).toBe("queued");
    expect(r.providerMessageId).toBe("SM123");
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending", idempotencyKey: "sms:test:1" }),
      })
    );
    expect(mockSendTwilio).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "hello",
    });
    expect(mockSmsLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log_1" },
        data: expect.objectContaining({
          status: "queued",
          providerMessageId: "SM123",
        }),
      })
    );
  });

  it("second call with same idempotency key does not call Twilio", async () => {
    mockSmsLogCreate.mockRejectedValueOnce({ code: "P2002" });
    mockSmsLogFindUnique.mockResolvedValueOnce({
      id: "log_existing",
      status: "queued",
      providerMessageId: "SM999",
    });

    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:test:dup",
    });

    expect(r.status).toBe("skipped");
    expect(r.failureMessage).toBe("duplicate_idempotency_key");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("concurrent duplicate while pending does not call Twilio", async () => {
    mockSmsLogCreate.mockRejectedValueOnce({ code: "P2002" });
    mockSmsLogFindUnique.mockResolvedValueOnce({
      id: "log_pending",
      status: "pending",
      providerMessageId: null,
    });

    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_READY",
      idempotencyKey: "sms:ORDER_READY:vo_1",
    });

    expect(r.status).toBe("skipped");
    expect(r.failureMessage).toBe("duplicate_in_flight");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("Twilio failure finalizes failed without throwing", async () => {
    mockSendTwilio.mockResolvedValue({ error: "Twilio error", code: "30001" });
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:test:fail",
    });
    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("30001");
    expect(mockSmsLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", errorCode: "30001" }),
      })
    );
  });

  it("retries after prior failed log by reclaiming reservation", async () => {
    mockSmsLogCreate.mockRejectedValueOnce({ code: "P2002" });
    mockSmsLogFindUnique.mockResolvedValueOnce({
      id: "log_failed",
      status: "failed",
      providerMessageId: null,
    });
    mockSmsLogUpdateMany.mockResolvedValueOnce({ count: 1 });

    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:ORDER_RECEIVED:ord_retry",
    });

    expect(r.status).toBe("queued");
    expect(mockSendTwilio).toHaveBeenCalledTimes(1);
    expect(mockSmsLogUpdateMany).toHaveBeenCalled();
  });

  it("opted-out phone suppresses without Twilio", async () => {
    mockIsPhoneSmsOptedOut.mockResolvedValue(true);
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:ORDER_RECEIVED:ord_1",
    });
    expect(r.status).toBe("suppressed");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("verification SMS uses Open Order template", async () => {
    await sendVerificationCodeSms({ to: "+15551234567", code: "123456" });
    expect(mockSendTwilio).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Open Order: Your verification code is 123456"),
      })
    );
    expect(mockSendTwilio.mock.calls[0][0].body).toContain("Reply STOP to opt out");
  });

  it("order ready SMS includes pickup code", async () => {
    await sendOrderReadySms({ to: "+15551234567", orderId: "ord_abc1234567890" });
    expect(mockSendTwilio).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Pickup code:"),
      })
    );
  });

  it("ORDER_RECEIVED helper uses stable idempotency key", async () => {
    await sendOrderReceivedSms({ to: "+15551234567", orderId: "ord_abc123" });
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: "sms:ORDER_RECEIVED:ord_abc123",
          status: "pending",
        }),
      })
    );
  });
});
