import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "test" },
}));

const mockSendTransactionalEmail = vi.fn();
const mockGenerateEmailVerificationToken = vi.fn();
const mockHashEmailVerificationToken = vi.fn();
const mockCreateAdminAuditLog = vi.fn();

vi.mock("@/lib/auth/email-verification-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/email-verification-token")>();
  return {
    ...actual,
    generateEmailVerificationToken: () => mockGenerateEmailVerificationToken(),
    hashEmailVerificationToken: (...args: unknown[]) => mockHashEmailVerificationToken(...args),
  };
});

vi.mock("@/lib/email/email.service", () => ({
  sendTransactionalEmail: (...args: unknown[]) => mockSendTransactionalEmail(...args),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://app.example.com",
}));

vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => mockCreateAdminAuditLog(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationToken: {
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
  EMAIL_ALREADY_VERIFIED_MESSAGE,
  EMAIL_VERIFICATION_COOLDOWN_MESSAGE,
  EMAIL_VERIFICATION_EXPIRED_MESSAGE,
  EMAIL_VERIFICATION_INVALID_MESSAGE,
  EMAIL_VERIFICATION_SENT_MESSAGE,
  EMAIL_VERIFICATION_USED_MESSAGE,
  sendEmailVerificationEmail,
  verifyEmailWithToken,
} from "@/services/email-verification.service";

describe("email-verification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmailVerificationToken.mockReturnValue("url-safe-token_abc123");
    mockHashEmailVerificationToken.mockImplementation((token: string) => `hash:${token}`);
    mockSendTransactionalEmail.mockResolvedValue({ status: "dry_run" });
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      if (typeof ops === "function") return ops(prisma as never);
      for (const op of ops) await op;
      return [];
    });
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({ id: "evt_1" } as never);
    vi.mocked(prisma.emailVerificationToken.update).mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
  });

  describe("sendEmailVerificationEmail", () => {
    it("returns already verified message without creating a token", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: new Date(),
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);

      const result = await sendEmailVerificationEmail({ userId: "user_1" });
      expect(result).toEqual({ ok: false, error: EMAIL_ALREADY_VERIFIED_MESSAGE });
      expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    });

    it("rate limits resend within cooldown window", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: new Date(),
        disabledAt: null,
      } as never);

      const result = await sendEmailVerificationEmail({ userId: "user_1" });
      expect(result).toEqual({ ok: false, error: EMAIL_VERIFICATION_COOLDOWN_MESSAGE });
    });

    it("stores hash and sends email on success", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);

      const result = await sendEmailVerificationEmail({ userId: "user_1", initiator: "user" });
      expect(result).toEqual({ ok: true, message: EMAIL_VERIFICATION_SENT_MESSAGE });
      expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenHash: "hash:url-safe-token_abc123",
            email: "a@example.com",
          }),
        })
      );
      expect(mockSendTransactionalEmail).toHaveBeenCalled();
    });

    it("does not mark sent when email delivery fails", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);
      mockSendTransactionalEmail.mockResolvedValue({
        status: "failed",
        failureMessage: "SMTP down",
      });

      const result = await sendEmailVerificationEmail({ userId: "user_1" });
      expect(result.ok).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("writes admin audit log only for admin-initiated sends", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);

      await sendEmailVerificationEmail({
        userId: "user_1",
        initiator: "admin",
        adminUserId: "admin_1",
        adminReason: "support ticket",
      });

      expect(mockCreateAdminAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe("verifyEmailWithToken", () => {
    it("rejects invalid tokens", async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null);

      const result = await verifyEmailWithToken("bad-token");
      expect(result).toEqual({
        ok: false,
        status: "invalid",
        message: EMAIL_VERIFICATION_INVALID_MESSAGE,
      });
    });

    it("rejects expired tokens", async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
        id: "evt_1",
        userId: "user_1",
        email: "a@example.com",
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        user: { email: "a@example.com", emailVerified: null },
      } as never);

      const result = await verifyEmailWithToken("token");
      expect(result).toEqual({
        ok: false,
        status: "expired",
        message: EMAIL_VERIFICATION_EXPIRED_MESSAGE,
      });
    });

    it("rejects used tokens when email is still unverified", async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
        id: "evt_1",
        userId: "user_1",
        email: "a@example.com",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        user: { email: "a@example.com", emailVerified: null },
      } as never);

      const result = await verifyEmailWithToken("token");
      expect(result).toEqual({
        ok: false,
        status: "used",
        message: EMAIL_VERIFICATION_USED_MESSAGE,
      });
    });

    it("rejects tokens when user email changed", async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
        id: "evt_1",
        userId: "user_1",
        email: "old@example.com",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: { email: "new@example.com", emailVerified: null },
      } as never);

      const result = await verifyEmailWithToken("token");
      expect(result).toEqual({
        ok: false,
        status: "invalid",
        message: EMAIL_VERIFICATION_INVALID_MESSAGE,
      });
    });

    it("verifies user with valid token", async () => {
      vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
        id: "evt_1",
        userId: "user_1",
        email: "a@example.com",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: { email: "a@example.com", emailVerified: null },
      } as never);

      const result = await verifyEmailWithToken("token");
      expect(result.ok).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user_1" },
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        })
      );
    });

    it("stores only a sanitized vendor claim return path in token metadata", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);
      await sendEmailVerificationEmail({
        userId: "user_1",
        initiator: "signup",
        returnPath: "/claim/vendor/secure_token",
      });
      expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: { returnPath: "/claim/vendor/secure_token" },
          }),
        })
      );
      expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            "next=%2Fclaim%2Fvendor%2Fsecure_token"
          ),
        })
      );
    });

    it("drops unsafe verification return URLs", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "a@example.com",
        emailVerified: null,
        emailVerificationLastSentAt: null,
        disabledAt: null,
      } as never);
      await sendEmailVerificationEmail({
        userId: "user_1",
        initiator: "signup",
        returnPath: "https://evil.example/claim/vendor/token",
      });
      const data = vi.mocked(prisma.emailVerificationToken.create).mock.calls[0]![0].data;
      expect(data.metadata).toBeUndefined();
      expect(mockSendTransactionalEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("evil.example") })
      );
    });
  });
});
