import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CartValidationError } from "@/services/cart-validation-error";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockTransaction = vi.fn();
const mockComputeFingerprint = vi.fn();
const mockFingerprintsMatch = vi.fn();
const mockGroupSessionFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupSessionFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: vi.fn().mockResolvedValue({ ok: true, isGroupOrder: true }),
}));

vi.mock("@/services/group-order-checkout-fingerprint.service", () => ({
  computeGroupCheckoutFingerprint: (...args: unknown[]) => mockComputeFingerprint(...args),
  groupCheckoutFingerprintsMatch: (...args: unknown[]) => mockFingerprintsMatch(...args),
}));

describe("group order checkout lock helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeFingerprint.mockResolvedValue("fp_locked_snapshot");
  });

  it("prepareGroupOrderCheckoutForHost locks active session and returns fingerprint", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        groupOrderSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "gos_1",
            hostUserId: "host_1",
            status: "active",
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const { prepareGroupOrderCheckoutForHost } = await import("./group-order.service");
    const result = await prepareGroupOrderCheckoutForHost("cart_1", "host_1");
    expect(result).toEqual({
      ok: true,
      checkoutFingerprint: "fp_locked_snapshot",
      sessionId: "gos_1",
    });
  });

  it("prepareGroupOrderCheckoutForHost allows same host when already locked_checkout", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        groupOrderSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "gos_1",
            hostUserId: "host_1",
            status: "locked_checkout",
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
        },
      };
      return fn(tx);
    });

    const { prepareGroupOrderCheckoutForHost } = await import("./group-order.service");
    const result = await prepareGroupOrderCheckoutForHost("cart_1", "host_1");
    expect(result.ok).toBe(true);
  });

  it("prepareGroupOrderCheckoutForHost blocks submitted sessions", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        groupOrderSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "gos_1",
            hostUserId: "host_1",
            status: "submitted",
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
        },
      };
      return fn(tx);
    });

    const { prepareGroupOrderCheckoutForHost } = await import("./group-order.service");
    const result = await prepareGroupOrderCheckoutForHost("cart_1", "host_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GROUP_ORDER_CLOSED");
  });

  it("rejects participant add while locked_checkout", async () => {
    const { assertCanAddLine } = await import("./group-order.service");
    try {
      assertCanAddLine({
        sessionId: "gos_1",
        sessionStatus: "locked_checkout",
        cartId: "cart_1",
        podId: "pod_1",
        participantId: "part_alex",
        role: "participant",
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect((e as CartValidationError).code).toBe("GROUP_ORDER_LOCKED_FOR_CHECKOUT");
      expect((e as CartValidationError).message).toMatch(/host is checking out/i);
    }
  });

  it("rejects host mutation while locked_checkout", async () => {
    const { assertCanMutateCartItem } = await import("./group-order.service");
    try {
      assertCanMutateCartItem({
        actor: {
          sessionId: "gos_1",
          sessionStatus: "locked_checkout",
          cartId: "cart_1",
          podId: "pod_1",
          participantId: "part_host",
          role: "host",
        },
        itemParticipantId: "part_host",
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect((e as CartValidationError).code).toBe("GROUP_ORDER_LOCKED_FOR_CHECKOUT");
      expect((e as CartValidationError).message).toMatch(/Return to checkout/i);
    }
  });

  it("assertGroupCartUnlockedForMutation blocks in-flight writes after lock", async () => {
    const { assertGroupCartUnlockedForMutation } = await import("./group-order.service");
    const tx = {
      groupOrderSession: {
        findUnique: vi.fn().mockResolvedValue({ status: "locked_checkout" }),
      },
    };
    await expect(
      assertGroupCartUnlockedForMutation(tx as never, "cart_1", {
        sessionId: "gos_1",
        sessionStatus: "active",
        cartId: "cart_1",
        podId: "pod_1",
        participantId: "part_alex",
        role: "participant",
      })
    ).rejects.toMatchObject({ code: "GROUP_ORDER_LOCKED_FOR_CHECKOUT" });
  });
});

describe("createOrderFromCart group checkout fingerprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFingerprintsMatch.mockResolvedValue(false);
    mockGroupSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "locked_checkout" });
  });

  it("returns GROUP_CART_CHANGED_DURING_CHECKOUT when fingerprint mismatches", async () => {
    const { createOrderFromCart } = await import("./order.service");
    await expect(
      createOrderFromCart({
        cartId: "cart_1",
        customerPhone: "+15551234567",
        tipCents: 0,
        idempotencyKey: "k1",
        groupOrderHostUserId: "host_1",
        groupCheckoutFingerprint: "stale_fp",
      })
    ).rejects.toMatchObject({
      code: "GROUP_CART_CHANGED_DURING_CHECKOUT",
    });
  });
});

describe("checkout wiring", () => {
  it("checkout page passes groupCheckoutFingerprint to CheckoutForm", () => {
    const src = readFileSync(join(process.cwd(), "src/app/checkout/page.tsx"), "utf8");
    expect(src).toMatch(/prepareGroupOrderCheckoutForHost/);
    expect(src).toMatch(/groupCheckoutFingerprint=\{groupCheckoutFingerprint\}/);
  });

  it("checkout API accepts groupCheckoutFingerprint", () => {
    const src = readFileSync(join(process.cwd(), "src/app/api/checkout/route.ts"), "utf8");
    expect(src).toMatch(/groupCheckoutFingerprint/);
  });

  it("CheckoutForm handles GROUP_CART_CHANGED_DURING_CHECKOUT", () => {
    const src = readFileSync(join(process.cwd(), "src/app/checkout/CheckoutForm.tsx"), "utf8");
    expect(src).toMatch(/GROUP_CART_CHANGED_DURING_CHECKOUT/);
    expect(src).toMatch(/Review group cart/);
  });
});
