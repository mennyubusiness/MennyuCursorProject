import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: vi.fn(),
}));

const mockPodVendorFindUnique = vi.fn();
const mockPodVendorFindMany = vi.fn();
const mockPodFindUnique = vi.fn();
const mockOperationalMenuIds = vi.fn();
const mockOperationalModOpts = vi.fn();
const mockShellBase = vi.fn();
const mockVariantCharge = vi.fn();
const mockMenuItemFindUnique = vi.fn();
const mockMenuItemFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
    },
    podVendor: {
      findUnique: (...args: unknown[]) => mockPodVendorFindUnique(...args),
      findMany: (...args: unknown[]) => mockPodVendorFindMany(...args),
    },
    menuItem: {
      findUnique: (...args: unknown[]) => mockMenuItemFindUnique(...args),
      findMany: (...args: unknown[]) => mockMenuItemFindMany(...args),
    },
  },
}));

vi.mock("@/services/menu-active-scope.service", () => ({
  getOperationalMenuItemIdsForVendor: (...args: unknown[]) => mockOperationalMenuIds(...args),
  getOperationalModifierOptionIdsForVendor: (...args: unknown[]) => mockOperationalModOpts(...args),
}));

vi.mock("@/services/cart-deliverect-variant-resolution", () => ({
  shellBasePriceCentsForMenuItem: (...args: unknown[]) => mockShellBase(...args),
  variantSelectionsPriceCentsForLeafCartLine: (...args: unknown[]) => mockVariantCharge(...args),
}));

import type { CartForValidation } from "./order.service";

const { validateCartForOrder, validateCartItemsForDisplay } = await import("./order.service");

function baseLine(overrides?: Partial<CartForValidation["items"][0]>): CartForValidation["items"][0] {
  return {
    id: "line_1",
    menuItemId: "mi_1",
    vendorId: "v_1",
    quantity: 1,
    priceCents: 500,
    menuItem: {
      priceCents: 500,
      isAvailable: true,
      name: "Burger",
    },
    vendor: { isActive: true, mennyuOrdersPaused: false },
    selections: [],
    ...overrides,
  };
}

function baseCart(items: CartForValidation["items"]): CartForValidation {
  return { podId: "pod_1", items };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPodFindUnique.mockResolvedValue({ isActive: true });
  mockPodVendorFindUnique.mockResolvedValue({ isActive: true });
  mockPodVendorFindMany.mockResolvedValue([{ vendorId: "v_1", isActive: true }]);
  mockOperationalMenuIds.mockResolvedValue(new Set(["mi_1", "mi_2"]));
  mockOperationalModOpts.mockResolvedValue(new Set(["opt_1"]));
  mockShellBase.mockResolvedValue(500);
  mockVariantCharge.mockResolvedValue(0);
  mockMenuItemFindUnique.mockResolvedValue({
    id: "mi_1",
    vendorId: "v_1",
    name: "Burger",
    isAvailable: true,
    basketMaxQuantity: null,
    modifierGroups: [],
  });
  mockMenuItemFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => {
    const ids = where.id.in;
    return ids.map((id) => ({
      id,
      vendorId: id === "mi_1" ? "v_1" : "v_2",
      name: id === "mi_1" ? "Burger" : "Fries",
      isAvailable: true,
      basketMaxQuantity: null,
      modifierGroups: [],
    }));
  });
});

describe("validateCartForOrder", () => {
  it("rejects unavailable item", async () => {
    const result = await validateCartForOrder(
      baseCart([baseLine({ menuItem: { priceCents: 500, isAvailable: false, name: "Burger" } })])
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("ITEM_UNAVAILABLE");
  });

  it("rejects snoozed item via isAvailable false", async () => {
    const result = await validateCartForOrder(
      baseCart([baseLine({ menuItem: { priceCents: 500, isAvailable: false, name: "Snoozed" } })])
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("ITEM_UNAVAILABLE");
  });

  it("rejects paused vendor", async () => {
    const result = await validateCartForOrder(
      baseCart([baseLine({ vendor: { isActive: true, mennyuOrdersPaused: true } })])
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("VENDOR_PAUSED_MENNYU");
  });

  it("rejects price changed", async () => {
    const result = await validateCartForOrder(
      baseCart([baseLine({ priceCents: 999 })])
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("PRICE_CHANGED");
  });

  it("rejects unavailable modifier option when supplied", async () => {
    mockMenuItemFindUnique.mockResolvedValue({
      id: "mi_1",
      vendorId: "v_1",
      name: "Burger",
      isAvailable: true,
      basketMaxQuantity: null,
      modifierGroups: [
        {
          required: true,
          minSelections: 1,
          maxSelections: 1,
          modifierGroup: {
            id: "mg_1",
            name: "Sauce",
            isAvailable: true,
            parentModifierOptionId: null,
            options: [{ id: "opt_1", name: "Ketchup", isAvailable: false, priceCents: 0, nestedModifierGroups: [] }],
          },
        },
      ],
    });
    const result = await validateCartForOrder(
      baseCart([
        baseLine({
          selections: [{ modifierOptionId: "opt_1", quantity: 1, modifierOption: { priceCents: 0 } }],
        }),
      ])
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("MODIFIER_OPTION_UNAVAILABLE");
  });

  it("applies VENDOR_CLOSED only when posOpen is explicitly false", async () => {
    const closed = await validateCartForOrder(
      baseCart([baseLine({ vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: false } })])
    );
    expect(closed.valid).toBe(false);
    if (!closed.valid) expect(closed.code).toBe("VENDOR_CLOSED");

    const open = await validateCartForOrder(
      baseCart([baseLine({ vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: undefined } })])
    );
    expect(open.valid).toBe(true);
  });

  it("rejects inactive pod", async () => {
    mockPodFindUnique.mockResolvedValue({ isActive: false });
    const result = await validateCartForOrder(baseCart([baseLine()]));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("POD_INACTIVE");
  });

  it("rejects vendor paused in pod", async () => {
    mockPodVendorFindUnique.mockResolvedValue({ isActive: false });
    const result = await validateCartForOrder(baseCart([baseLine()]));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe("VENDOR_PAUSED_IN_POD");
  });
});

describe("validateCartItemsForDisplay multi-vendor", () => {
  it("flags only paused vendor lines while other vendor stays valid", async () => {
    mockOperationalMenuIds.mockImplementation(async (vendorId: string) => {
      if (vendorId === "v_1") return new Set(["mi_1"]);
      return new Set(["mi_2"]);
    });
    mockPodVendorFindMany.mockResolvedValue([
      { vendorId: "v_1", isActive: true },
      { vendorId: "v_2", isActive: true },
    ]);

    const cart = baseCart([
      baseLine({ id: "line_1", menuItemId: "mi_1", vendorId: "v_1" }),
      baseLine({
        id: "line_2",
        menuItemId: "mi_2",
        vendorId: "v_2",
        menuItem: { priceCents: 300, isAvailable: true, name: "Fries" },
        priceCents: 300,
        vendor: { isActive: true, mennyuOrdersPaused: true },
      }),
    ]);
    mockShellBase.mockImplementation(async (item: { priceCents: number }) => item.priceCents);
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        vendorId: "v_1",
        name: "Burger",
        isAvailable: true,
        basketMaxQuantity: null,
        modifierGroups: [],
      },
      {
        id: "mi_2",
        vendorId: "v_2",
        name: "Fries",
        isAvailable: true,
        basketMaxQuantity: null,
        modifierGroups: [],
      },
    ]);

    const result = await validateCartItemsForDisplay(cart);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.cartItemId).toBe("line_2");
    expect(result.errors[0]?.code).toBe("VENDOR_PAUSED_MENNYU");
  });

  it("flags vendor paused in pod on display validation", async () => {
    mockPodVendorFindMany.mockResolvedValue([{ vendorId: "v_1", isActive: false }]);
    const result = await validateCartItemsForDisplay(baseCart([baseLine()]));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("VENDOR_PAUSED_IN_POD");
  });
});
