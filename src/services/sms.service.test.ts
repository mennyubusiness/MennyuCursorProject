import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSmsLogFindUnique = vi.fn();
const mockSmsLogCreate = vi.fn();
const mockSendTwilio = vi.fn();
const mockIsPhoneSmsOptedOut = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    smsMessageLog: {
      findUnique: (...args: unknown[]) => mockSmsLogFindUnique(...args),
      create: (...args: unknown[]) => mockSmsLogCreate(...args),
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
  sendSms,
  sendTransactionalSms,
  sendVerificationCodeSms,
} from "./sms.service";

describe("sms.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSmsLogFindUnique.mockResolvedValue(null);
    mockSmsLogCreate.mockResolvedValue({ id: "log_1" });
    mockSendTwilio.mockResolvedValue({ sid: "SM123", status: "queued" });
    mockIsPhoneSmsOptedOut.mockResolvedValue(false);
    vi.mocked(resolveSmsMode).mockReturnValue("twilio");
    vi.mocked(shouldSendViaTwilio).mockReturnValue(true);
  });

  it("SMS_MODE=log does not call Twilio", async () => {
    vi.mocked(resolveSmsMode).mockReturnValue("log");
    vi.mocked(shouldSendViaTwilio).mockReturnValue(false);
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
    });
    expect(r.status).toBe("logged");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("SMS_MODE=disabled skips send", async () => {
    vi.mocked(resolveSmsMode).mockReturnValue("disabled");
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
    });
    expect(r.status).toBe("skipped");
    expect(mockSendTwilio).not.toHaveBeenCalled();
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

  it("successful Twilio send records providerMessageId", async () => {
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
      idempotencyKey: "sms:test:1",
    });
    expect(r.status).toBe("queued");
    expect(r.providerMessageId).toBe("SM123");
    expect(mockSendTwilio).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "hello",
    });
  });

  it("Twilio failure records failed without throwing", async () => {
    mockSendTwilio.mockResolvedValue({ error: "Twilio error", code: "30001" });
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
    });
    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("30001");
  });

  it("opted-out phone suppresses send", async () => {
    mockIsPhoneSmsOptedOut.mockResolvedValue(true);
    const r = await sendSms({
      to: "+15551234567",
      body: "hello",
      type: "ORDER_RECEIVED",
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
});
