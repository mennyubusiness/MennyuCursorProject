import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockAuth = vi.fn();
const mockFindSessionByCartId = vi.fn();
const mockStartGroupOrderSession = vi.fn();
const mockUnlock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderSession: { findFirst: vi.fn() },
    cart: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/cart.service", () => ({
  CART_DISPLAY_SESSION_CART_INCLUDE: {},
}));

vi.mock("@/services/group-order.service", () => ({
  findSessionByCartId: (...args: unknown[]) => mockFindSessionByCartId(...args),
  resolveActorForGroupCart: vi.fn().mockResolvedValue(null),
  startGroupOrderSession: (...args: unknown[]) => mockStartGroupOrderSession(...args),
  unlockGroupOrderSessionFromCheckout: (...args: unknown[]) => mockUnlock(...args),
}));

vi.mock("@/lib/group-order-session-lifecycle", () => ({
  expireGroupOrderSessionIfStale: vi.fn().mockResolvedValue("unchanged"),
}));

describe("group-order-cart-page (server render helpers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user_1", name: "Sam" } });
  });

  it("getGroupOrderStateForCartPage does not revalidate", async () => {
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      joinCode: "123456",
      status: "active",
      podId: "pod_1",
      hostUserId: "user_1",
      participants: [{ id: "p1", displayName: "Sam", role: "host", leftAt: null }],
    });
    const { getGroupOrderStateForCartPage } = await import("./group-order-cart-page");
    const state = await getGroupOrderStateForCartPage("cart_1");
    expect(state.active).toBe(true);
    if (state.active && state.view === "host") {
      expect(state.joinCode).toBe("123456");
      expect(state.isHost).toBe(true);
    }
  });

  it("startGroupOrderForCartPage returns success without cache APIs", async () => {
    mockStartGroupOrderSession.mockResolvedValue({ sessionId: "gos_1", joinCode: "654321" });
    const { startGroupOrderForCartPage } = await import("./group-order-cart-page");
    const res = await startGroupOrderForCartPage("cart_1", "pod_1", "user_1", "Sam");
    expect(res).toEqual({ success: true, sessionId: "gos_1", joinCode: "654321" });
  });

  it("startGroupOrderForCartPage maps known errors", async () => {
    mockStartGroupOrderSession.mockRejectedValue(new Error("GROUP_ORDER_SESSION_EXISTS"));
    const { startGroupOrderForCartPage } = await import("./group-order-cart-page");
    const res = await startGroupOrderForCartPage("cart_1", "pod_1", "user_1", "Sam");
    expect(res).toEqual({
      success: false,
      error: "This cart already has a group order.",
    });
  });
});

describe("cart page render must not trigger revalidatePath", () => {
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const cartPageLibSrc = readFileSync(join(process.cwd(), "src/lib/group-order-cart-page.ts"), "utf8");
  const groupActionsSrc = readFileSync(
    join(process.cwd(), "src/actions/group-order.actions.ts"),
    "utf8"
  );

  it("cart page does not import mutation server actions for render bootstrap", () => {
    expect(cartPageSrc).toMatch(/group-order-cart-page/);
    expect(cartPageSrc).not.toMatch(/startGroupOrderFromCartAction/);
    expect(cartPageSrc).not.toMatch(/unlockGroupCheckoutAction/);
    expect(cartPageSrc).not.toMatch(/getGroupOrderStateAction/);
  });

  it("cart page render helpers omit revalidatePath calls", () => {
    expect(cartPageLibSrc).not.toMatch(/from "next\/cache"/);
    expect(cartPageLibSrc).not.toMatch(/revalidatePath\(/);
  });

  it("start group order action still revalidates outside render", () => {
    expect(groupActionsSrc).toMatch(/startGroupOrderForCartPage/);
    expect(groupActionsSrc).toMatch(/revalidatePath\("\/cart"\)/);
  });
});
