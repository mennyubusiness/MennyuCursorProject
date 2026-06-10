import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAssertCustomerSession = vi.fn();
const mockGetCustomerSessionFromRequest = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/customer-session", () => ({
  assertCustomerSession: (...args: unknown[]) => mockAssertCustomerSession(...args),
  getCustomerSessionFromRequest: (...args: unknown[]) => mockGetCustomerSessionFromRequest(...args),
  createCustomerSessionRecord: vi.fn().mockResolvedValue({ token: "tok_new", expiresAt: new Date() }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customerAccount: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

import {
  getUserLinkedVerifiedPhoneAccount,
  isUserPhoneVerifiedForCheckout,
  resolveCheckoutPhoneForOrder,
  resolveCheckoutPhoneVerification,
} from "./customer-checkout-phone-verification";

describe("isUserPhoneVerifiedForCheckout", () => {
  const account = {
    customerAccountId: "ca_1",
    phoneE164: "+15033486843",
    phoneVerifiedAt: new Date("2026-01-01"),
  };

  it("matches formatted US checkout phone to E.164 account phone", () => {
    expect(isUserPhoneVerifiedForCheckout(account, "(503) 348-6843")).toBe(true);
    expect(isUserPhoneVerifiedForCheckout(account, "+15033486843")).toBe(true);
  });

  it("returns false for guest (null account)", () => {
    expect(isUserPhoneVerifiedForCheckout(null, "+15033486843")).toBe(false);
  });

  it("returns false when checkout phone differs", () => {
    expect(isUserPhoneVerifiedForCheckout(account, "(503) 348-6844")).toBe(false);
  });

  it("returns false for invalid phone", () => {
    expect(isUserPhoneVerifiedForCheckout(account, "abc")).toBe(false);
  });
});

describe("resolveCheckoutPhoneForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomerSessionFromRequest.mockResolvedValue(null);
  });

  function request() {
    return new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }

  it("allows checkout with no phone when SMS is off", async () => {
    const result = await resolveCheckoutPhoneForOrder(request(), null, "", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.phoneE164).toBe("");
      expect(result.customerAccountId).toBeNull();
    }
  });

  it("allows unverified phone when SMS consent is off", async () => {
    const result = await resolveCheckoutPhoneForOrder(request(), null, "(503) 348-6843", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.phoneE164).toBe("+15033486843");
      expect(result.customerAccountId).toBeNull();
    }
  });

  it("requires OTP verification when SMS consent is on", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
    });

    const result = await resolveCheckoutPhoneForOrder(request(), null, "+15551234567", true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CUSTOMER_SESSION_REQUIRED");
    }
  });
});

describe("resolveCheckoutPhoneVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomerSessionFromRequest.mockResolvedValue(null);
  });

  function request() {
    return new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }

  it("guest without customer session requires OTP", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
    });

    const result = await resolveCheckoutPhoneVerification(request(), null, "+15551234567");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CUSTOMER_SESSION_REQUIRED");
    }
  });

  it("guest with customer session matching phone passes", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: true,
      customerAccountId: "ca_guest",
      phoneE164: "+15551234567",
    });

    const result = await resolveCheckoutPhoneVerification(request(), null, "5551234567");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.phoneE164).toBe("+15551234567");
      expect(result.customerAccountId).toBe("ca_guest");
    }
  });

  it("signed-in user with linked verified phone bypasses OTP session", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
    });
    mockFindFirst.mockResolvedValue({
      id: "ca_user",
      phoneE164: "+15033486843",
      phoneVerifiedAt: new Date("2026-01-01"),
    });

    const result = await resolveCheckoutPhoneVerification(
      request(),
      "user_1",
      "(503) 348-6843"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.customerAccountId).toBe("ca_user");
      expect(result.phoneE164).toBe("+15033486843");
      expect(result.establishCustomerSession).toBe(true);
    }
  });

  it("signed-in user with different checkout phone requires OTP", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
    });
    mockFindFirst.mockResolvedValue({
      id: "ca_user",
      phoneE164: "+15033486843",
      phoneVerifiedAt: new Date("2026-01-01"),
    });

    const result = await resolveCheckoutPhoneVerification(
      request(),
      "user_1",
      "(503) 348-6844"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CUSTOMER_SESSION_REQUIRED");
    }
  });

  it("rejects customer session phone mismatch", async () => {
    mockAssertCustomerSession.mockResolvedValue({
      ok: true,
      customerAccountId: "ca_1",
      phoneE164: "+15559999999",
    });

    const result = await resolveCheckoutPhoneVerification(request(), null, "+15551234567");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PHONE_MISMATCH");
    }
  });
});

describe("getUserLinkedVerifiedPhoneAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads linked account with verified timestamp", async () => {
    mockFindFirst.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
      phoneVerifiedAt: new Date("2026-06-01"),
    });

    const account = await getUserLinkedVerifiedPhoneAccount("user_1");
    expect(account?.phoneE164).toBe("+15551234567");
    expect(account?.customerAccountId).toBe("ca_1");
  });
});
