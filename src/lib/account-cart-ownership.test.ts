import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockCartFindMany = vi.fn();
const mockCartFindUnique = vi.fn();
const mockCartUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: {
      findMany: (...args: unknown[]) => mockCartFindMany(...args),
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
      update: (...args: unknown[]) => mockCartUpdate(...args),
    },
  },
}));

import {
  attachGuestCartToUser,
  findActiveAccountSoloCartId,
  isAccountSoloCartRow,
  isGuestSoloCartRow,
  resolveAccountCartOwnershipOnSignIn,
} from "@/lib/account-cart-ownership";

const USER_ID = "user_1";
const SESSION_ID = "sess_guest";
const ACCOUNT_CART = "cart_account";
const GUEST_CART = "cart_guest";

function cartRow(
  id: string,
  overrides: Partial<{
    userId: string | null;
    sessionId: string;
    itemCount: number;
    groupStatus: string | null;
  }> = {}
) {
  return {
    id,
    podId: "pod_1",
    sessionId: overrides.sessionId ?? SESSION_ID,
    userId: overrides.userId ?? null,
    updatedAt: new Date("2026-06-04T12:00:00Z"),
    items: Array.from({ length: overrides.itemCount ?? 0 }, (_, i) => ({ id: `line_${i}` })),
    groupOrderSession: overrides.groupStatus ? { status: overrides.groupStatus } : null,
  };
}

describe("account cart row helpers", () => {
  it("identifies account solo rows", () => {
    expect(isAccountSoloCartRow(cartRow("c1", { userId: USER_ID, itemCount: 1 }))).toBe(true);
    expect(
      isAccountSoloCartRow(cartRow("c1", { userId: USER_ID, groupStatus: "active" }))
    ).toBe(false);
  });

  it("identifies guest solo rows", () => {
    expect(isGuestSoloCartRow(cartRow("c1", { itemCount: 2 }))).toBe(true);
    expect(isGuestSoloCartRow(cartRow("c1", { userId: USER_ID }))).toBe(false);
  });
});

describe("resolveAccountCartOwnershipOnSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves existing account cart when guest also has items", async () => {
    mockCartFindMany.mockImplementation(async (args: { where: { userId?: string; sessionId?: string } }) => {
      if (args.where.userId) {
        return [cartRow(ACCOUNT_CART, { userId: USER_ID, itemCount: 2 })];
      }
      return [cartRow(GUEST_CART, { itemCount: 1 })];
    });

    const result = await resolveAccountCartOwnershipOnSignIn(USER_ID, SESSION_ID);

    expect(result).toEqual({
      accountCartId: ACCOUNT_CART,
      claimedGuestCart: false,
      preservedExistingAccountCart: true,
    });
    expect(mockCartUpdate).not.toHaveBeenCalled();
  });

  it("claims guest cart when account has no assigned cart", async () => {
    mockCartFindMany.mockImplementation(async (args: { where: { userId?: string; sessionId?: string } }) => {
      if (args.where.userId) return [];
      return [cartRow(GUEST_CART, { itemCount: 1 })];
    });
    mockCartFindUnique.mockResolvedValue(cartRow(GUEST_CART, { itemCount: 1 }));
    mockCartUpdate.mockResolvedValue({});

    const result = await resolveAccountCartOwnershipOnSignIn(USER_ID, SESSION_ID);

    expect(result.claimedGuestCart).toBe(true);
    expect(result.accountCartId).toBe(GUEST_CART);
    expect(mockCartUpdate).toHaveBeenCalledWith({
      where: { id: GUEST_CART },
      data: { userId: USER_ID },
    });
  });
});

describe("findActiveAccountSoloCartId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned account cart id", async () => {
    mockCartFindMany.mockResolvedValue([
      cartRow(ACCOUNT_CART, { userId: USER_ID, itemCount: 1 }),
    ]);

    await expect(findActiveAccountSoloCartId(USER_ID, "pod_1")).resolves.toBe(ACCOUNT_CART);
  });

  it("returns null when account solo cart has no items", async () => {
    mockCartFindMany.mockResolvedValue([
      cartRow(ACCOUNT_CART, { userId: USER_ID, itemCount: 0 }),
    ]);

    await expect(findActiveAccountSoloCartId(USER_ID, "pod_1")).resolves.toBeNull();
  });
});

describe("attachGuestCartToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses active group carts", async () => {
    mockCartFindUnique.mockResolvedValue(
      cartRow(GUEST_CART, { groupStatus: "active" })
    );

    await expect(attachGuestCartToUser(GUEST_CART, USER_ID)).resolves.toBe(false);
    expect(mockCartUpdate).not.toHaveBeenCalled();
  });
});
