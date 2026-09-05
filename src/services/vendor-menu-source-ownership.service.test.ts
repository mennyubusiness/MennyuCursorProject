import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuVersionState } from "@prisma/client";

const mockVendorFindUnique = vi.fn();
const mockVendorUpdate = vi.fn();
const mockMenuVersionFindMany = vi.fn();
const mockMenuVersionUpdateMany = vi.fn();
const mockMenuItemFindMany = vi.fn();
const mockMenuItemUpdateMany = vi.fn();

const mockApplyCanonical = vi.fn();

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
      update: vi.fn(),
    },
    menuItem: {
      findMany: (...args: unknown[]) => mockMenuItemFindMany(...args),
      updateMany: (...args: unknown[]) => mockMenuItemUpdateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn((await import("@/lib/db")).prisma),
  },
}));

vi.mock("@/services/menu-apply-canonical-live", () => ({
  applyCanonicalMenuToLiveTables: (...args: unknown[]) => mockApplyCanonical(...args),
}));

import { reconcileVendorMenuSourceOwnership } from "@/services/vendor-menu-source-ownership";

function deliverectSnapshot(productAvailable = true) {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [
      {
        deliverectId: "del-1",
        name: "Burger",
        priceCents: 1000,
        isAvailable: productAvailable,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
    ],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
  };
}

function openOrderSnapshot() {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [
      {
        deliverectId: "oo:prod:1",
        name: "Taco",
        priceCents: 800,
        isAvailable: true,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
    ],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "open_order_builder_v1" },
  };
}

function squareSnapshot(productAvailable = true) {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [
      {
        deliverectId: "sq:prod:1",
        name: "Bowl",
        priceCents: 1200,
        isAvailable: productAvailable,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
      {
        deliverectId: "sq:prod:soldout",
        name: "Sold out bowl",
        priceCents: 1200,
        isAvailable: false,
        sortOrder: 1,
        modifierGroupDeliverectIds: [],
      },
    ],
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
    mockApplyCanonical.mockResolvedValue(undefined);
  });

  it("Square → tablet: adopts Square catalog and restores snapshot-available items", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_sq",
        state: MenuVersionState.archived,
        canonicalSnapshot: squareSnapshot(true),
      },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    expect(result.menuSource).toBe("open_order");
    expect(result.provider).toBe("open_order");
    expect(result.archivedMenuVersionIds).toEqual([]);
    expect(result.softDisabledMenuItemCount).toBe(0);
    expect(result.restoredMenuVersionIds).toEqual(["mv_sq"]);
    expect(mockMenuItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isAvailable: false,
          deliverectProductId: { in: ["sq:prod:1"] },
        }),
        data: { isAvailable: true },
      })
    );
    expect(mockMenuVersionUpdateMany).not.toHaveBeenCalled();
  });

  it("Deliverect → tablet: adopts Deliverect catalog instead of retiring it", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_del",
        state: MenuVersionState.published,
        canonicalSnapshot: deliverectSnapshot(true),
      },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    expect(result.archivedMenuVersionIds).toEqual([]);
    expect(result.softDisabledMenuItemCount).toBe(0);
    expect(mockMenuItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliverectProductId: { in: ["del-1"] },
        }),
        data: { isAvailable: true },
      })
    );
  });

  it("does not restore snapshot-sold-out products when adopting Square", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_sq",
        state: MenuVersionState.published,
        canonicalSnapshot: squareSnapshot(true),
      },
    ]);

    await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    const restoreArg = mockMenuItemUpdateMany.mock.calls[0]?.[0];
    expect(restoreArg?.where?.deliverectProductId?.in).toEqual(["sq:prod:1"]);
    expect(restoreArg?.where?.deliverectProductId?.in).not.toContain("sq:prod:soldout");
  });

  it("Case 4 — tablet → Deliverect: archives Open Order published without rewriting native isAvailable", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", state: MenuVersionState.published, canonicalSnapshot: openOrderSnapshot() },
      { id: "mv_del", state: MenuVersionState.published, canonicalSnapshot: deliverectSnapshot() },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
    });

    expect(result.menuSource).toBe("deliverect");
    expect(result.provider).toBe("deliverect");
    expect(result.archivedMenuVersionIds).toEqual(["mv_oo"]);
    expect(result.softDisabledMenuItemCount).toBe(0);
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("Case 5 — Square: switching to square archives other catalogs without disabling native items", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_del", state: MenuVersionState.published, canonicalSnapshot: deliverectSnapshot() },
      { id: "mv_sq", state: MenuVersionState.published, canonicalSnapshot: squareSnapshot() },
      { id: "mv_oo", state: MenuVersionState.published, canonicalSnapshot: openOrderSnapshot() },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "square",
    });

    expect(result.menuSource).toBe("open_order");
    expect(result.provider).toBe("square");
    expect(result.archivedMenuVersionIds.sort()).toEqual(["mv_del", "mv_oo"].sort());
    expect(result.softDisabledMenuItemCount).toBe(0);
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("A — Native → Square → Native keeps authoring availability on oo:prod items", async () => {
    const nativeTwo = {
      schemaVersion: 1,
      vendorId: "v1",
      categories: [],
      products: [
        {
          deliverectId: "oo:prod:A",
          name: "A",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
        {
          deliverectId: "oo:prod:B",
          name: "B",
          priceCents: 100,
          isAvailable: false,
          sortOrder: 1,
          modifierGroupDeliverectIds: [],
        },
      ],
      modifierGroupDefinitions: [],
      deliverect: { sourcePayloadKind: "open_order_builder_v1" },
    };

    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", state: MenuVersionState.published, canonicalSnapshot: nativeTwo },
      { id: "mv_sq", state: MenuVersionState.published, canonicalSnapshot: squareSnapshot() },
    ]);

    await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "square",
    });
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();

    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", state: MenuVersionState.archived, canonicalSnapshot: nativeTwo },
      { id: "mv_sq", state: MenuVersionState.published, canonicalSnapshot: squareSnapshot() },
    ]);

    const back = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });
    expect(back.provider).toBe("open_order");
    expect(back.restoredMenuVersionIds).toEqual(["mv_oo"]);
    expect(mockApplyCanonical).toHaveBeenCalled();
  });

  it("B — Native → Deliverect → Native does not rewrite native isAvailable", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", state: MenuVersionState.published, canonicalSnapshot: openOrderSnapshot() },
      { id: "mv_del", state: MenuVersionState.published, canonicalSnapshot: deliverectSnapshot() },
    ]);

    await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
    });
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
    expect(mockApplyCanonical).not.toHaveBeenCalled();

    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_oo", state: MenuVersionState.archived, canonicalSnapshot: openOrderSnapshot() },
      { id: "mv_del", state: MenuVersionState.published, canonicalSnapshot: deliverectSnapshot() },
    ]);

    await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });
    expect(mockApplyCanonical).toHaveBeenCalled();
  });

  it("does not archive the active provider published menu", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      { id: "mv_del", state: MenuVersionState.published, canonicalSnapshot: deliverectSnapshot() },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
    });

    expect(result.archivedMenuVersionIds).toEqual([]);
    expect(mockMenuVersionUpdateMany).not.toHaveBeenCalled();
  });

  it("does not restore snapshot-unavailable (unpublished / sold-out) products", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_sq",
        state: MenuVersionState.published,
        canonicalSnapshot: squareSnapshot(false),
      },
    ]);

    await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("native Open Order publish wins: does not restore a coexisting Square catalog", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_oo",
        state: MenuVersionState.published,
        canonicalSnapshot: openOrderSnapshot(),
      },
      {
        id: "mv_sq",
        state: MenuVersionState.published,
        canonicalSnapshot: squareSnapshot(true),
      },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
    });

    expect(result.restoredMenuVersionIds).toEqual([]);
    expect(result.archivedMenuVersionIds).toEqual(["mv_sq"]);
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("vendors still on Square routing keep Square items and do not restore foreign catalogs", async () => {
    mockVendorFindUnique.mockResolvedValue({
      id: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_sq",
        state: MenuVersionState.published,
        canonicalSnapshot: squareSnapshot(true),
      },
    ]);
    mockMenuItemFindMany.mockResolvedValue([
      { id: "item_sq", deliverectProductId: "sq:prod:1" },
    ]);

    const result = await reconcileVendorMenuSourceOwnership({
      vendorId: "v1",
      orderRoutingMode: "square",
    });

    expect(result.provider).toBe("square");
    expect(result.archivedMenuVersionIds).toEqual([]);
    expect(result.restoredAvailableMenuItemCount).toBe(0);
    expect(mockMenuItemUpdateMany).not.toHaveBeenCalled();
  });
});
