import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/customer-session", () => ({
  getCustomerSessionFromRequest: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/user-order-access", () => ({
  userCanAccessOrder: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/session", () => ({
  CUSTOMER_PHONE_COOKIE: "mennyu_customer_phone",
  ORDER_ACCESS_COOKIE: "mennyu_order_access",
  MENNYU_SESSION_MAX_AGE: 3600,
  getCustomerPhoneFromHeaders: vi.fn(),
  getCustomerOrderAccessTokenFromHeaders: vi.fn(),
  buildCustomerPhoneCookieHeader: (phone: string) =>
    `mennyu_customer_phone=${encodeURIComponent(phone)}; Path=/; HttpOnly`,
  buildOrderAccessCookieHeader: (token: string) =>
    `mennyu_order_access=${encodeURIComponent(token)}; Path=/; HttpOnly`,
}));

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCustomerSessionFromRequest } from "@/lib/customer-session";
import { userCanAccessOrder } from "@/lib/user-order-access";
import {
  getCustomerOrderAccessTokenFromHeaders,
  getCustomerPhoneFromHeaders,
} from "@/lib/session";
import {
  createCustomerOrderAccessToken,
  verifyCustomerOrderAccessToken,
} from "./customer-order-access-token";
import {
  assertCustomerOrderAccess,
  buildPersistedCustomerOrderAccessCookieHeaders,
  persistCustomerOrderAccessCookies,
  resolveCustomerOrderAccessBootstrap,
} from "./customer-order-access";

describe("assertCustomerOrderAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(userCanAccessOrder).mockResolvedValue(false);
    vi.mocked(getCustomerSessionFromRequest).mockResolvedValue(null);
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
      customerAccountId: null,
      customerEmail: null,
    } as never);
  });

  it("allows matching phone", async () => {
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue("+15551234567");
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(true);
  });

  it("denies wrong phone", async () => {
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue("+15550000000");
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("denies unauthenticated callers without phone or token", async () => {
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("allows valid signed access token without phone cookie", async () => {
    const token = createCustomerOrderAccessToken("ord_1");
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);
    const r = await assertCustomerOrderAccess("ord_1", new Headers(), token);
    expect(r.ok).toBe(true);
  });

  it("allows access token from cookie", async () => {
    const token = createCustomerOrderAccessToken("ord_1");
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(token);
    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(true);
  });

  it("rejects token for a different order", async () => {
    const token = createCustomerOrderAccessToken("ord_other");
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    const r = await assertCustomerOrderAccess("ord_1", new Headers(), token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("allows matching CustomerSession + order.customerAccountId", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
      customerAccountId: "acct_1",
    } as never);
    vi.mocked(getCustomerSessionFromRequest).mockResolvedValue({
      customerAccountId: "acct_1",
      phoneE164: "+15551234567",
      sessionId: "sess_1",
    });
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);

    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(true);
  });

  it("rejects wrong CustomerSession for order with customerAccountId", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
      customerAccountId: "acct_1",
    } as never);
    vi.mocked(getCustomerSessionFromRequest).mockResolvedValue({
      customerAccountId: "acct_other",
      phoneE164: "+15550000000",
      sessionId: "sess_2",
    });
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);

    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("legacy order without customerAccountId still works with signed order access token", async () => {
    const token = createCustomerOrderAccessToken("ord_legacy");
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_legacy",
      customerPhone: "+15551234567",
      customerAccountId: null,
    } as never);
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);

    const r = await assertCustomerOrderAccess("ord_legacy", new Headers(), token);
    expect(r.ok).toBe(true);
  });

  it("allows signed-in user who owns the order", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user_1", email: "customer@example.com" },
    } as never);
    vi.mocked(userCanAccessOrder).mockResolvedValue(true);
    vi.mocked(getCustomerPhoneFromHeaders).mockReturnValue(null);
    vi.mocked(getCustomerOrderAccessTokenFromHeaders).mockReturnValue(null);

    const r = await assertCustomerOrderAccess("ord_1", new Headers());
    expect(r.ok).toBe(true);
  });
});

describe("resolveCustomerOrderAccessBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
    } as never);
  });

  it("resolves valid token", async () => {
    const token = createCustomerOrderAccessToken("ord_1");
    const r = await resolveCustomerOrderAccessBootstrap("ord_1", token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.customerPhone).toBe("+15551234567");
  });

  it("rejects invalid token", async () => {
    const r = await resolveCustomerOrderAccessBootstrap("ord_1", "bad-token");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe("buildPersistedCustomerOrderAccessCookieHeaders", () => {
  it("returns HttpOnly phone and access cookie headers", () => {
    const headers = buildPersistedCustomerOrderAccessCookieHeaders("token_abc", "+15551234567");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain("mennyu_customer_phone=");
    expect(headers[0]).toContain("HttpOnly");
    expect(headers[1]).toContain("mennyu_order_access=");
    expect(headers[1]).toContain("HttpOnly");
  });
});

describe("persistCustomerOrderAccessCookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551234567",
    } as never);
  });

  it("sets HttpOnly phone and access cookies for a valid token", async () => {
    const token = createCustomerOrderAccessToken("ord_1");
    const set = vi.fn();
    vi.mocked(cookies).mockResolvedValue({ set } as never);

    const r = await persistCustomerOrderAccessCookies("ord_1", token);
    expect(r.ok).toBe(true);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[0]?.[2]).toMatchObject({ httpOnly: true });
    expect(set.mock.calls[1]?.[2]).toMatchObject({ httpOnly: true });
  });

  it("rejects invalid token", async () => {
    const r = await persistCustomerOrderAccessCookies("ord_1", "bad-token");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe("customer-order-access-token", () => {
  it("creates and verifies tokens", () => {
    const token = createCustomerOrderAccessToken("ord_sms");
    expect(verifyCustomerOrderAccessToken("ord_sms", token)).toBe(true);
    expect(verifyCustomerOrderAccessToken("ord_other", token)).toBe(false);
  });
});
