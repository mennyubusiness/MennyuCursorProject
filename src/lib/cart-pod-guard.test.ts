import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockPodFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
    },
  },
}));

describe("assertSessionAllowsAddToCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPodFindUnique.mockResolvedValue({ name: "New Pod" });
  });

  it("blocks add when another cart in the session has items", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "cart_a",
        podId: "pod_a",
        pod: { name: "Pod A" },
        items: [{ id: "line_1" }],
        groupOrderSession: null,
      },
      {
        id: "cart_b",
        podId: "pod_b",
        pod: { name: "Pod B" },
        items: [],
        groupOrderSession: null,
      },
    ]);

    const { assertSessionAllowsAddToCart } = await import("@/lib/cart-pod-guard");

    await expect(assertSessionAllowsAddToCart("sess_1", "cart_b", "pod_b")).rejects.toMatchObject({
      code: "CART_POD_MISMATCH",
    });
  });

  it("allows add when no other assigned cart exists", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "cart_b",
        podId: "pod_b",
        pod: { name: "Pod B" },
        items: [],
        groupOrderSession: null,
      },
    ]);

    const { assertSessionAllowsAddToCart } = await import("@/lib/cart-pod-guard");

    await expect(
      assertSessionAllowsAddToCart("sess_1", "cart_b", "pod_b")
    ).resolves.toBeUndefined();
  });
});
