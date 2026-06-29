import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const mockPricingTransaction = vi.fn();
const mockMenuItemFindFirst = vi.fn();
const mockMenuItemUpdate = vi.fn();
const mockModifierFindFirst = vi.fn();
const mockModifierUpdate = vi.fn();

vi.mock("@/lib/admin-action-context", () => ({
  requireAdminActionContext: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPricingTransaction(...args),
    menuItem: {
      findFirst: (...args: unknown[]) => mockMenuItemFindFirst(...args),
      update: (...args: unknown[]) => mockMenuItemUpdate(...args),
    },
    modifierOption: {
      findFirst: (...args: unknown[]) => mockModifierFindFirst(...args),
      update: (...args: unknown[]) => mockModifierUpdate(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  setMenuItemDeliverectProductId,
  setModifierOptionDeliverectModifierId,
} from "@/actions/admin-deliverect-mapping.actions";
import { updateActivePricingConfig } from "@/actions/pricing-config.actions";

const pricingInput = {
  customerServiceFeePercent: 3.5,
  customerServiceFeeFlatCents: 0,
  vendorProcessingFeePercent: 2.9,
  vendorProcessingFeeFlatCents: 30,
};

describe("Sprint A admin action auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPricingTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        pricingConfig: {
          updateMany: vi.fn(),
          create: vi.fn(),
        },
      });
    });
    mockMenuItemFindFirst.mockResolvedValue({ id: "item_1" });
    mockMenuItemUpdate.mockResolvedValue({});
    mockModifierFindFirst.mockResolvedValue({ id: "opt_1" });
    mockModifierUpdate.mockResolvedValue({});
  });

  it("rejects unauthenticated pricing updates", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthorized." });

    const result = await updateActivePricingConfig(pricingInput);
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockPricingTransaction).not.toHaveBeenCalled();
  });

  it("allows authorized pricing updates", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });

    const result = await updateActivePricingConfig(pricingInput);
    expect(result).toEqual({ ok: true });
    expect(mockPricingTransaction).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated Deliverect menu item mapping updates", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthorized." });

    const result = await setMenuItemDeliverectProductId("item_1", "vendor_1", "plu-1");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockMenuItemUpdate).not.toHaveBeenCalled();
  });

  it("rejects Deliverect mapping when menu item is not for vendor", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockMenuItemFindFirst.mockResolvedValue(null);

    const result = await setMenuItemDeliverectProductId("item_1", "vendor_1", "plu-1");
    expect(result).toEqual({ ok: false, error: "Menu item not found for this vendor." });
    expect(mockMenuItemUpdate).not.toHaveBeenCalled();
  });

  it("allows authorized Deliverect modifier mapping updates", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });

    const result = await setModifierOptionDeliverectModifierId("opt_1", "vendor_1", "mod-1");
    expect(result).toEqual({ ok: true });
    expect(mockModifierUpdate).toHaveBeenCalledTimes(1);
  });
});
