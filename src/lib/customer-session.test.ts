import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    customerSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  assertCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  getCustomerSessionFromRequest,
  hashCustomerSessionToken,
} from "@/lib/customer-session";

describe("customer-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customerSession.update).mockResolvedValue({} as never);
  });

  it("rejects expired customer session", async () => {
    const token = "raw_token_abc";
    vi.mocked(prisma.customerSession.findUnique).mockResolvedValue({
      id: "sess_1",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      customerAccount: { id: "acct_1", phoneE164: "+15551234567" },
    } as never);

    const headers = new Headers({
      cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    });
    const session = await getCustomerSessionFromRequest(headers);
    expect(session).toBeNull();
  });

  it("rejects revoked customer session", async () => {
    const token = "raw_token_revoked";
    vi.mocked(prisma.customerSession.findUnique).mockResolvedValue({
      id: "sess_1",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
      customerAccount: { id: "acct_1", phoneE164: "+15551234567" },
    } as never);

    const headers = new Headers({
      cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    });
    const session = await getCustomerSessionFromRequest(headers);
    expect(session).toBeNull();
  });

  it("returns customer account for valid session", async () => {
    const token = "valid_token";
    vi.mocked(prisma.customerSession.findUnique).mockResolvedValue({
      id: "sess_1",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      customerAccount: { id: "acct_1", phoneE164: "+15551234567" },
    } as never);

    const req = new NextRequest("http://localhost/checkout", {
      headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}` },
    });
    const session = await getCustomerSessionFromRequest(req);
    expect(session).toEqual({
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
      sessionId: "sess_1",
    });
    expect(prisma.customerSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashCustomerSessionToken(token) },
      })
    );
  });

  it("assertCustomerSession rejects missing cookie", async () => {
    const result = await assertCustomerSession(new Headers());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
