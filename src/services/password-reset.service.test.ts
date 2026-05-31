import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHashPassword = vi.fn();
const mockVerifyPassword = vi.fn();
const mockSendTransactionalEmail = vi.fn();
const mockGeneratePasswordResetToken = vi.fn();
const mockHashPasswordResetToken = vi.fn();

vi.mock("@/lib/auth/password", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
}));

vi.mock("@/lib/auth/password-reset-token", () => ({
  PASSWORD_RESET_TTL_MS: 60 * 60 * 1000,
  generatePasswordResetToken: () => mockGeneratePasswordResetToken(),
  hashPasswordResetToken: (...args: unknown[]) => mockHashPasswordResetToken(...args),
}));

vi.mock("@/lib/email/email.service", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactionalEmail(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import {
  PASSWORD_RESET_GENERIC_FAILURE_MESSAGE,
  PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyUserPassword,
} from "@/services/password-reset.service";

describe("password-reset.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockResolvedValue("$new_hash$");
    mockVerifyPassword.mockResolvedValue(false);
    mockGeneratePasswordResetToken.mockReturnValue("raw_reset_token_abc123");
    mockHashPasswordResetToken.mockImplementation((token: string) => `hash:${token}`);
    mockSendTransactionalEmail.mockResolvedValue({ status: "dry_run" });
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      if (typeof ops === "function") return ops(prisma as never);
      for (const op of ops) await op;
      return [];
    });
    vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: "prt_1" } as never);
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
  });

  it("creates hashed token and sends email for existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);

    const result = await requestPasswordReset("user@example.com", "https://app.example.com");

    expect(result).toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE });
    expect(mockGeneratePasswordResetToken).toHaveBeenCalled();
    expect(mockHashPasswordResetToken).toHaveBeenCalledWith("raw_reset_token_abc123");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          tokenHash: "hash:raw_reset_token_abc123",
        }),
      })
    );
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Reset your Open Order password",
        eventType: "password_reset",
      })
    );
    const emailArg = mockSendTransactionalEmail.mock.calls[0]?.[0] as { text: string };
    expect(emailArg.text).toContain("https://app.example.com/reset-password?token=");
    expect(emailArg.text).toContain("Reset your Open Order password");
  });

  it("returns generic success for unknown email and sends nothing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await requestPasswordReset("unknown@example.com");

    expect(result).toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("returns generic success for user without password hash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: null,
    } as never);

    const result = await requestPasswordReset("user@example.com");

    expect(result.ok).toBe(true);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("does not store raw token in DB", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);

    await requestPasswordReset("user@example.com");

    const createArg = vi.mocked(prisma.passwordResetToken.create).mock.calls[0]?.[0];
    expect(createArg?.data.tokenHash).toBe("hash:raw_reset_token_abc123");
    expect(createArg?.data.tokenHash).not.toBe("raw_reset_token_abc123");
  });

  it("resets password and consumes valid token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { passwordHash: "$old$" },
    } as never);

    const result = await resetPasswordWithToken("raw_reset_token_abc123", "newpassword1");

    expect(result.ok).toBe(true);
    expect(mockHashPassword).toHaveBeenCalledWith("newpassword1");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: { passwordHash: "$new_hash$" },
      })
    );
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prt_1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    );
  });

  it("rejects consumed token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      user: { passwordHash: "$old$" },
    } as never);

    const result = await resetPasswordWithToken("raw_reset_token_abc123", "newpassword1");

    expect(result).toEqual({ ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects expired token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      user: { passwordHash: "$old$" },
    } as never);

    const result = await resetPasswordWithToken("raw_reset_token_abc123", "newpassword1");

    expect(result).toEqual({ ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    const result = await resetPasswordWithToken("bad_token", "newpassword1");

    expect(result).toEqual({ ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE });
  });

  it("enforces register password rules on reset", async () => {
    const result = await resetPasswordWithToken("raw_reset_token_abc123", "short");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("8 characters");
    }
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("verifyUserPassword uses stored hash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: "$stored$",
    } as never);
    mockVerifyPassword.mockResolvedValue(true);

    const ok = await verifyUserPassword("user_1", "newpassword1");
    expect(ok).toBe(true);
    expect(mockVerifyPassword).toHaveBeenCalledWith("newpassword1", "$stored$");
  });

  it("old password no longer matches after reset when verify returns false for old", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { passwordHash: "$old$" },
    } as never);

    await resetPasswordWithToken("raw_reset_token_abc123", "newpassword1");

    mockVerifyPassword.mockImplementation(async (plain, hash) => {
      if (plain === "oldpassword1" && hash === "$old$") return true;
      if (plain === "newpassword1" && hash === "$new_hash$") return true;
      return false;
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: "$new_hash$" } as never);
    expect(await verifyUserPassword("user_1", "newpassword1")).toBe(true);

    mockVerifyPassword.mockResolvedValue(false);
    expect(await verifyUserPassword("user_1", "oldpassword1")).toBe(false);
  });
});
