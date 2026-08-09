import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuVersionState } from "@prisma/client";

const mockVendorFindUnique = vi.fn();
const mockVendorUpdate = vi.fn();
const mockMenuVersionFindMany = vi.fn();
const mockMenuVersionUpdateMany = vi.fn();
const mockMenuItemFindMany = vi.fn();
const mockMenuItemUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
      update: (...args: unknown[]) => mockVendorUpdate(...args),
      findMany: vi.fn(),
    },
    menuVersion: {
      findMany: (...args: unknown[]) => mockMenuVersionFindMany(...args),
      updateMany: (...args: unknown[]) => mockMenuVersionUpdateMany(...args),
    },
    menuItem: {
      findMany: (...args: unknown[]) => mockMenuItemFindMany(...args),
      updateMany: (...args: unknown[]) => mockMenuItemUpdateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn((await import("@/lib/db")).prisma),
  },
}));

import { reconcileVendorMenuSourceOwnership } from "@/services/vendor-menu-source-ownership.service";

function deliverectSnapshot() {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [{ deliverectId: "del-1", name: "Burger", price: 10, sortOrder: 0 }],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
  };
}

function openOrderSnapshot() {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [{ deliverectId: "oo:prod:1", name: "Taco", price: 8, sortOrder: 0 }],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "open_order_builder_v1" },
  };
}

function squareSnapshot() {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [{ deliverectId: "sq:prod:1", name: "Bowl", price: 12, sortOrder: 0 }],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "square_catalog_v1" },
  };
}

describe("reconcileVendorMenuSourceOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorUpdate.mockResolvedValue({});
    mockMenuVersionUpdateMany.mockResolvedValue({ count: 1 });
    mockMenuItemUpdateMany.mockResolvedValue({ count: 1 });
    mockMenuItemFindMany.mockResolvedValue([]);
  });

  it("Case 2 — Deliverect → tablet: sets open_order, archives Deliverect published, soft-disables Deliverect items", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_del", canonicalSnapshot: deliverectSnapshot() },
      { id: "mv_oo", canonicalSnapshot: openOrderSnapshot() },
    ]);
    mockMenuItemFindMany.mockResolvedValue([
      { id: "item_del", deliverectProductId: "del-1" },
      { id: "item_oo", deliverectProductId: "oo:prod:1" },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    expect(result.menuSource).toBe("open_order");
    expect(result.provider).toBe("open_order");
    expect(result.archivedMenuVersionIds).toEqual(["mv_del"]);
    expect(mockVendorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          orderRoutingMode: "manual_dashboard",
          menuSource: "open_order",
        },
      })
    );
    expect(mockMenuVersionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["mv_del"] } },
        data: { state: MenuVersionState.archived },
      })
    );
    expect(mockMenuItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["item_del"] } },
        data: { isAvailable: false },
      })
    );
    // Historical OO item remains available for builder/publish; Deliverect soft-disabled only.
    expect(result.softDisabledMenuItemCount).toBe(1);
  });

  it("Case 4 — tablet → Deliverect: archives Open Order published and soft-disables oo items", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", canonicalSnapshot: openOrderSnapshot() },
      { id: "mv_del", canonicalSnapshot: deliverectSnapshot() },
    ]);
    mockMenuItemFindMany.mockResolvedValue([
      { id: "item_oo", deliverectProductId: "oo:prod:1" },
      { id: "item_del", deliverectProductId: "del-1" },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
    });

    expect(result.menuSource).toBe("deliverect");
    expect(result.provider).toBe("deliverect");
    expect(result.archivedMenuVersionIds).toEqual(["mv_oo"]);
    expect(mockMenuItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["item_oo"] } },
        data: { isAvailable: false },
      })
    );
  });

  it("Case 5 — Square: switching to square archives Deliverect and soft-disables non-Square items", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_del", canonicalSnapshot: deliverectSnapshot() },
      { id: "mv_sq", canonicalSnapshot: squareSnapshot() },
      { id: "mv_oo", canonicalSnapshot: openOrderSnapshot() },
    ]);
    mockMenuItemFindMany.mockResolvedValue([
      { id: "item_del", deliverectProductId: "del-1" },
      { id: "item_sq", deliverectProductId: "sq:prod:1" },
      { id: "item_oo", deliverectProductId: "oo:prod:1" },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "square",
    });

    expect(result.menuSource).toBe("open_order");
    expect(result.provider).toBe("square");
    expect(result.archivedMenuVersionIds.sort()).toEqual(["mv_del", "mv_oo"].sort());
    expect(mockMenuItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(["item_del", "item_oo"]) } },
        data: { isAvailable: false },
      })
    );
  });

  it("does not archive the active provider published menu", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_del", canonicalSnapshot: deliverectSnapshot() },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
    });

    expect(result.archivedMenuVersionIds).toEqual([]);
    expect(mockMenuVersionUpdateMany).not.toHaveBeenCalled();
  });
});
