import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHashPassword = vi.fn();
const mockVerifyPassword = vi.fn();
const mockSendVerificationCodeSms = vi.fn();
const mockCreateCustomerSessionRecord = vi.fn();

vi.mock("@/lib/auth/password", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
}));

vi.mock("@/services/sms.service", () => ({
  sendVerificationCodeSms: (...args: unknown[]) => mockSendVerificationCodeSms(...args),
}));

vi.mock("@/lib/customer-session", () => ({
  createCustomerSessionRecord: (...args: unknown[]) => mockCreateCustomerSessionRecord(...args),
}));

vi.mock("@/services/customer-account-orders.service", () => ({
  attachLegacyOrdersToCustomerAccount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customerPhoneVerification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerAccount: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { attachLegacyOrdersToCustomerAccount } from "@/services/customer-account-orders.service";
import {
  CUSTOMER_PHONE_OTP_MAX_ATTEMPTS,
  sendPhoneVerificationCode,
  verifyPhoneVerificationCode,
} from "@/services/customer-phone-otp.service";

describe("customer-phone-otp.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockResolvedValue("$hash$");
    mockVerifyPassword.mockResolvedValue(false);
    mockSendVerificationCodeSms.mockResolvedValue({ status: "logged" });
    mockCreateCustomerSessionRecord.mockResolvedValue({
      token: "session_token_raw",
      expiresAt: new Date(Date.now() + 86400000),
    });
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customerPhoneVerification.create).mockResolvedValue({ id: "ver_1" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        customerPhoneVerification: {
          update: vi.fn().mockResolvedValue({}),
        },
        customerAccount: {
          upsert: vi.fn().mockResolvedValue({
            id: "acct_1",
            phoneE164: "+15551234567",
          }),
        },
      } as never)
    );
  });

  it("send-code normalizes phone and creates a verification row", async () => {
    const result = await sendPhoneVerificationCode("(555) 123-4567");

    expect(result.ok).toBe(true);
    expect(prisma.customerPhoneVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneE164: "+15551234567",
          codeHash: "$hash$",
        }),
      })
    );
    expect(mockSendVerificationCodeSms).toHaveBeenCalled();
  });

  it("send-code stores hash, not raw code", async () => {
    await sendPhoneVerificationCode("5551234567");

    expect(mockHashPassword).toHaveBeenCalledWith(expect.stringMatching(/^\d{6}$/));
    const createArg = vi.mocked(prisma.customerPhoneVerification.create).mock.calls[0]?.[0];
    expect(createArg?.data.codeHash).toBe("$hash$");
    expect(createArg?.data.codeHash).not.toMatch(/^\d{6}$/);
  });

  it("verify-code rejects wrong code and increments attempts", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue({
      id: "ver_1",
      phoneE164: "+15551234567",
      codeHash: "$hash$",
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    } as never);
    mockVerifyPassword.mockResolvedValue(false);
    const update = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.customerPhoneVerification.update).mockImplementation(update);

    const result = await verifyPhoneVerificationCode("5551234567", "000000");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attemptCount: { increment: 1 } },
      })
    );
  });

  it("verify-code rejects expired code", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue(null);

    const result = await verifyPhoneVerificationCode("5551234567", "123456");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired/i);
  });

  it("verify-code rejects consumed code", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue(null);

    const result = await verifyPhoneVerificationCode("5551234567", "123456");

    expect(result.ok).toBe(false);
  });

  it("verify-code locks/rejects after too many attempts", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue({
      id: "ver_1",
      phoneE164: "+15551234567",
      codeHash: "$hash$",
      attemptCount: CUSTOMER_PHONE_OTP_MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    } as never);

    const result = await verifyPhoneVerificationCode("5551234567", "123456");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });

  it("verify-code success creates/upserts CustomerAccount", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue({
      id: "ver_1",
      phoneE164: "+15551234567",
      codeHash: "$hash$",
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    } as never);
    mockVerifyPassword.mockResolvedValue(true);
    const upsert = vi.fn().mockResolvedValue({
      id: "acct_1",
      phoneE164: "+15551234567",
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        customerPhoneVerification: { update: vi.fn().mockResolvedValue({}) },
        customerAccount: { upsert },
      } as never)
    );

    const result = await verifyPhoneVerificationCode("5551234567", "123456");

    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  it("verify-code success creates CustomerSession and attaches legacy orders", async () => {
    vi.mocked(prisma.customerPhoneVerification.findFirst).mockResolvedValue({
      id: "ver_1",
      phoneE164: "+15551234567",
      codeHash: "$hash$",
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    } as never);
    mockVerifyPassword.mockResolvedValue(true);

    const result = await verifyPhoneVerificationCode("5551234567", "123456");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionToken).toBe("session_token_raw");
      expect(mockCreateCustomerSessionRecord).toHaveBeenCalledWith("acct_1");
      expect(attachLegacyOrdersToCustomerAccount).toHaveBeenCalledWith("acct_1", "+15551234567");
    }
  });
});
