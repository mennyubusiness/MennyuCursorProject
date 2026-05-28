import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSmsLogFindUnique = vi.fn();
const mockSmsLogCreate = vi.fn();
const mockSendTwilio = vi.fn();

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

vi.mock("@/lib/sms-config", () => ({
  isSmsEnabled: vi.fn(() => true),
  isSmsDryRun: vi.fn(() => false),
  isSmsLogOnly: vi.fn(() => false),
  shouldSendViaTwilio: vi.fn(() => true),
  smsOperationalError: vi.fn(() => null),
}));

import { isSmsDryRun, isSmsEnabled, shouldSendViaTwilio } from "@/lib/sms-config";
import {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendTransactionalSms,
} from "./sms.service";

describe("sms.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSmsLogFindUnique.mockResolvedValue(null);
    mockSmsLogCreate.mockResolvedValue({ id: "log_1" });
    mockSendTwilio.mockResolvedValue({ sid: "SM123" });
    vi.mocked(isSmsEnabled).mockReturnValue(true);
    vi.mocked(isSmsDryRun).mockReturnValue(false);
    vi.mocked(shouldSendViaTwilio).mockReturnValue(true);
  });

  it("returns skipped when SMS disabled", async () => {
    vi.mocked(isSmsEnabled).mockReturnValue(false);
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("skipped");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("dry run does not call Twilio", async () => {
    vi.mocked(isSmsDryRun).mockReturnValue(true);
    vi.mocked(shouldSendViaTwilio).mockReturnValue(false);
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("dry_run");
    expect(mockSendTwilio).not.toHaveBeenCalled();
    expect(mockSmsLogCreate).toHaveBeenCalled();
  });

  it("skips missing phone", async () => {
    const r = await sendTransactionalSms({
      to: "",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("skipped");
    expect(r.failureMessage).toBe("missing_destination_phone");
  });

  it("skips invalid phone", async () => {
    const r = await sendTransactionalSms({
      to: "abc",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("skipped");
    expect(r.failureMessage).toBe("invalid_phone_number");
  });

  it("successful send records providerMessageId", async () => {
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
      idempotencyKey: "sms:test:1",
    });
    expect(r.status).toBe("sent");
    expect(r.providerMessageId).toBe("SM123");
    expect(mockSendTwilio).toHaveBeenCalledWith({
      to: "+15551234567",
      body: "hello",
    });
  });

  it("Twilio failure records failed without throwing", async () => {
    mockSendTwilio.mockResolvedValue({ error: "Twilio error" });
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
    });
    expect(r.status).toBe("failed");
    expect(r.failureMessage).toBe("Twilio error");
  });

  it("idempotency prevents duplicate send", async () => {
    mockSmsLogFindUnique.mockResolvedValue({ status: "sent", providerMessageId: "SM_old" });
    const r = await sendTransactionalSms({
      to: "+15551234567",
      body: "hello",
      eventType: "test",
      idempotencyKey: "sms:dup:1",
    });
    expect(r.status).toBe("skipped");
    expect(r.failureMessage).toBe("duplicate_idempotency_key");
    expect(mockSendTwilio).not.toHaveBeenCalled();
  });

  it("order confirmation uses idempotency key", async () => {
    await sendOrderConfirmation("+15551234567", "ord_abc123", 1500, "ASAP pickup");
    expect(mockSmsLogFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "sms:order_confirmation:ord_abc123" },
      })
    );
  });

  it("ready status SMS includes pickup code", async () => {
    await sendOrderStatusUpdate("+15551234567", "ord_abc123", "ready");
    expect(mockSendTwilio).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Pickup code:"),
      })
    );
  });
});
