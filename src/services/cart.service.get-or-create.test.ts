import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

const mockCartFindUnique = vi.fn();
const mockCartCreate = vi.fn();
const mockOrderUpdateMany = vi.fn();
const mockGroupOrderSessionFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
      create: (...args: unknown[]) => mockCartCreate(...args),
    },
    order: {
      updateMany: (...args: unknown[]) => mockOrderUpdateMany(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupOrderSessionFindUnique(...args),
    },
  },
}));

import {
  CART_MUTATION_CART_INCLUDE,
  CART_SESSION_FULL_INCLUDE,
  findOrCreateCartForPodSession,
  getOrCreateCart,
  getOrCreateCartForVendorMenuPage,
} from "@/services/cart.service";

const POD_ID = "pod_1";
const SESSION_ID = "sess_1";
const CART_ID = "cart_1";

function podSessionCartRow(overrides?: Record<string, unknown>) {
  return {
    id: CART_ID,
    podId: POD_ID,
    sessionId: SESSION_ID,
    items: [],
    pod: { id: POD_ID, name: "Test Pod" },
    ...overrides,
  };
}

function p2002PodSession(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["podId", "sessionId"] },
  });
}

describe("findOrCreateCartForPodSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 0 });
    mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  });

  it("returns existing cart without creating when row already exists", async () => {
    const row = podSessionCartRow();
    mockCartFindUnique.mockResolvedValueOnce(row);

    const result = await findOrCreateCartForPodSession(
      POD_ID,
      SESSION_ID,
      CART_SESSION_FULL_INCLUDE
    );

    expect(result).toBe(row);
    expect(mockCartCreate).not.toHaveBeenCalled();
    expect(mockCartFindUnique).toHaveBeenCalledTimes(1);
  });

  it("creates cart when none exists", async () => {
    const row = podSessionCartRow();
    mockCartFindUnique.mockResolvedValueOnce(null);
    mockCartCreate.mockResolvedValueOnce(row);

    const result = await findOrCreateCartForPodSession(
      POD_ID,
      SESSION_ID,
      CART_SESSION_FULL_INCLUDE
    );

    expect(result).toBe(row);
    expect(mockCartCreate).toHaveBeenCalledWith({
      data: { podId: POD_ID, sessionId: SESSION_ID },
      include: CART_SESSION_FULL_INCLUDE,
    });
  });

  it("fetches existing cart when concurrent create hits P2002", async () => {
    const row = podSessionCartRow();
    mockCartFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    mockCartCreate.mockRejectedValueOnce(p2002PodSession());

    const result = await findOrCreateCartForPodSession(
      POD_ID,
      SESSION_ID,
      CART_SESSION_FULL_INCLUDE
    );

    expect(result).toBe(row);
    expect(mockCartFindUnique).toHaveBeenCalledTimes(2);
    expect(mockCartFindUnique).toHaveBeenNthCalledWith(2, {
      where: { podId_sessionId: { podId: POD_ID, sessionId: SESSION_ID } },
      include: CART_SESSION_FULL_INCLUDE,
    });
  });

  it("rethrows non-P2002 create errors", async () => {
    mockCartFindUnique.mockResolvedValueOnce(null);
    mockCartCreate.mockRejectedValueOnce(new Error("db down"));

    await expect(
      findOrCreateCartForPodSession(POD_ID, SESSION_ID, CART_SESSION_FULL_INCLUDE)
    ).rejects.toThrow("db down");
  });

  it("rethrows P2002 when follow-up fetch still misses the row", async () => {
    const err = p2002PodSession();
    mockCartFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCartCreate.mockRejectedValueOnce(err);

    await expect(
      findOrCreateCartForPodSession(POD_ID, SESSION_ID, CART_SESSION_FULL_INCLUDE)
    ).rejects.toBe(err);
  });
});

describe("getOrCreateCartForVendorMenuPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 0 });
    mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  });

  it("uses lean vendor-menu include and survives P2002 race", async () => {
    const row = podSessionCartRow({
      items: [],
      pod: undefined,
    });
    mockCartFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    mockCartCreate.mockRejectedValueOnce(p2002PodSession());

    const cart = await getOrCreateCartForVendorMenuPage(POD_ID, SESSION_ID);

    expect(cart.id).toBe(CART_ID);
    expect(cart.podId).toBe(POD_ID);
    expect(mockCartCreate).toHaveBeenCalledWith({
      data: { podId: POD_ID, sessionId: SESSION_ID },
      include: CART_MUTATION_CART_INCLUDE,
    });
    expect(mockOrderUpdateMany).toHaveBeenCalledWith({
      where: {
        sourceCartId: CART_ID,
        status: { notIn: ["pending_payment", "failed"] },
      },
      data: { sourceCartId: null },
    });
  });
});

describe("getOrCreateCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderUpdateMany.mockResolvedValue({ count: 0 });
    mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  });

  it("returns mapped cart from existing row without create", async () => {
    mockCartFindUnique.mockResolvedValueOnce(podSessionCartRow());

    const cart = await getOrCreateCart(POD_ID, SESSION_ID);

    expect(cart.id).toBe(CART_ID);
    expect(cart.groups).toEqual([]);
    expect(mockCartCreate).not.toHaveBeenCalled();
  });
});
