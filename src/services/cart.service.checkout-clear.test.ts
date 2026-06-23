import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";

describe("clearCheckoutSourceCartForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes cart items and unlinks sourceCartId", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      sourceCartId: "cart_checkout",
    } as never);
    vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({} as never);

    await clearCheckoutSourceCartForOrder("ord_1");

    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart_checkout" },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { sourceCartId: null },
    });
  });

  it("no-ops when order has no sourceCartId", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      sourceCartId: null,
    } as never);

    await clearCheckoutSourceCartForOrder("ord_1");

    expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
