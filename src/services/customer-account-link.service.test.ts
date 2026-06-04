import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockAttachLegacy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    customerAccount: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

vi.mock("@/services/customer-account-orders.service", () => ({
  attachLegacyOrdersToCustomerAccount: (...args: unknown[]) => mockAttachLegacy(...args),
}));

import {
  linkCheckoutCustomerAccountToUser,
  linkVerifiedPhoneToUserAfterOtp,
} from "./customer-account-link.service";

describe("linkVerifiedPhoneToUserAfterOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachLegacy.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
  });

  it("unlinks prior user phone before linking new verified phone", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_new",
      phoneE164: "+15559876543",
      userId: null,
      phoneVerifiedAt: new Date("2026-01-01"),
    });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mockAttachLegacy.mockResolvedValue(0);

    await linkVerifiedPhoneToUserAfterOtp({
      userId: "user_1",
      customerAccountId: "ca_new",
      phoneE164: "+15559876543",
    });

    expect(mockUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "user_1", id: { not: "ca_new" } },
      data: { userId: null },
    });
  });
});

describe("linkCheckoutCustomerAccountToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachLegacy.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
  });

  it("links unlinked CustomerAccount to signed-in User", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
      userId: null,
      phoneVerifiedAt: new Date("2026-01-01"),
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockAttachLegacy.mockResolvedValue(2);

    const result = await linkCheckoutCustomerAccountToUser({
      userId: "user_1",
      customerAccountId: "ca_1",
      phoneE164: "+15551234567",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyLinked).toBe(false);
      expect(result.legacyOrdersAttached).toBe(2);
    }
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "ca_1", userId: null },
      data: { userId: "user_1" },
    });
  });

  it("is idempotent when already linked to current user", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
      userId: "user_1",
      phoneVerifiedAt: new Date("2026-01-01"),
    });

    const result = await linkCheckoutCustomerAccountToUser({
      userId: "user_1",
      customerAccountId: "ca_1",
      phoneE164: "+15551234567",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alreadyLinked).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockAttachLegacy).toHaveBeenCalledWith("ca_1", "+15551234567");
  });

  it("rejects when CustomerAccount belongs to another User", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
      userId: "user_other",
      phoneVerifiedAt: new Date("2026-01-01"),
    });

    const result = await linkCheckoutCustomerAccountToUser({
      userId: "user_1",
      customerAccountId: "ca_1",
      phoneE164: "+15551234567",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ALREADY_LINKED_OTHER");
      expect(result.error).toMatch(/another account/i);
    }
  });

  it("rejects when User already has a different linked phone", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_2",
      phoneE164: "+15559876543",
      userId: null,
      phoneVerifiedAt: new Date("2026-01-01"),
    });
    mockFindFirst.mockResolvedValue({ id: "ca_1" });

    const result = await linkCheckoutCustomerAccountToUser({
      userId: "user_1",
      customerAccountId: "ca_2",
      phoneE164: "+15559876543",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("USER_HAS_OTHER_PHONE");
  });

  it("rejects session phone mismatch", async () => {
    mockFindUnique.mockResolvedValue({
      id: "ca_1",
      phoneE164: "+15551234567",
      userId: null,
      phoneVerifiedAt: new Date("2026-01-01"),
    });

    const result = await linkCheckoutCustomerAccountToUser({
      userId: "user_1",
      customerAccountId: "ca_1",
      phoneE164: "+15550000000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SESSION_MISMATCH");
  });
});
