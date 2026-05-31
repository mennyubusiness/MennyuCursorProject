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

vi.mock("@/lib/auth/password-reset-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/password-reset-token")>();
  return {
    ...actual,
    generatePasswordResetToken: () => mockGeneratePasswordResetToken(),
    hashPasswordResetToken: (...args: unknown[]) => mockHashPasswordResetToken(...args),
  };
});

vi.mock("@/lib/email/email.service", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactionalEmail(...args),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://app.example.com",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
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
  resolvePasswordResetLinkOrigin,
  verifyUserPassword,
} from "@/services/password-reset.service";

describe("password-reset.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
    mockHashPassword.mockResolvedValue("$new_hash$");
    mockVerifyPassword.mockResolvedValue(false);
    mockGeneratePasswordResetToken.mockReturnValue("url-safe-token_abc123");
    mockHashPasswordResetToken.mockImplementation((token: string) => `hash:${token}`);
    mockSendTransactionalEmail.mockResolvedValue({ status: "dry_run" });
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      if (typeof ops === "function") return ops(prisma as never);
      for (const op of ops) await op;
      return [];
    });
    vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: "prt_1" } as never);
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as never);
    vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
  });

  it("creates hashed token and sends email for existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);

    const result = await requestPasswordReset("user@example.com", "http://localhost:3000");

    expect(result).toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE });
    expect(mockHashPasswordResetToken).toHaveBeenCalledWith("url-safe-token_abc123");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          tokenHash: "hash:url-safe-token_abc123",
        }),
      })
    );
    const emailArg = mockSendTransactionalEmail.mock.calls[0]?.[0] as { text: string };
    expect(emailArg.text).toContain(
      "http://localhost:3000/reset-password?token=url-safe-token_abc123"
    );
  });

  it("uses PUBLIC_APP_URL for reset links when configured", () => {
    process.env.PUBLIC_APP_URL = "https://app.example.com";
    expect(resolvePasswordResetLinkOrigin("http://localhost:3000")).toBe("https://app.example.com");
  });

  it("skips duplicate reset requests within dedupe window", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({ id: "prt_existing" } as never);

    const result = await requestPasswordReset("user@example.com");

    expect(result.ok).toBe(true);
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("deletes prior active tokens when issuing a new reset after dedupe window", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);

    await requestPasswordReset("user@example.com");

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1", consumedAt: null }),
      })
    );
  });

  it("returns generic success for unknown email and sends nothing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await requestPasswordReset("unknown@example.com");

    expect(result).toEqual({ ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("does not store raw token in DB", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "$old$",
    } as never);

    await requestPasswordReset("user@example.com");

    const createArg = vi.mocked(prisma.passwordResetToken.create).mock.calls[0]?.[0];
    expect(createArg?.data.tokenHash).toBe("hash:url-safe-token_abc123");
    expect(createArg?.data.tokenHash).not.toBe("url-safe-token_abc123");
  });

  it("resets password, sets passwordChangedAt, and consumes valid token only after success", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { passwordHash: "$old$" },
    } as never);

    const result = await resetPasswordWithToken("url-safe-token_abc123", "newpassword1");

    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: expect.objectContaining({
          passwordHash: "$new_hash$",
          passwordChangedAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prt_1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    );
  });

  it("does not consume token when password validation fails", async () => {
    const result = await resetPasswordWithToken("url-safe-token_abc123", "short");

    expect(result.ok).toBe(false);
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });

  it("does not consume token when lookup fails", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    await resetPasswordWithToken("bad_token", "newpassword1");

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });

  it("rejects consumed token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "prt_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      user: { passwordHash: "$old$" },
    } as never);

    const result = await resetPasswordWithToken("url-safe-token_abc123", "newpassword1");

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

    const result = await resetPasswordWithToken("url-safe-token_abc123", "newpassword1");

    expect(result).toEqual({ ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid token", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    const result = await resetPasswordWithToken("bad_token", "newpassword1");

    expect(result).toEqual({ ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE });
  });

  it("verifyUserPassword uses stored hash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: "$stored$",
    } as never);
    mockVerifyPassword.mockResolvedValue(true);

    const ok = await verifyUserPassword("user_1", "newpassword1");
    expect(ok).toBe(true);
  });
});
