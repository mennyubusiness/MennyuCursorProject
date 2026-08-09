import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuVersionState } from "@prisma/client";

const mockVendorFindUnique = vi.fn();
const mockMenuVersionFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
    },
    menuVersion: {
      findMany: (...args: unknown[]) => mockMenuVersionFindMany(...args),
    },
  },
}));

import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";

function snapshot(kind: string, productId: string) {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    categories: [],
    products: [
      {
        deliverectId: productId,
        name: "Item",
        priceCents: 100,
        isAvailable: true,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
    ],
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: kind },
  };
}

describe("loadActiveMenuVersionForVendor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case 1 — Deliverect vendor selects Deliverect published menu", async () => {
    mockVendorFindUnique.mockResolvedValue({
      menuSource: "deliverect",
      orderRoutingMode: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_del",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("deliverect_menu_api_v1", "del-1"),
      },
      {
        id: "mv_oo",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("open_order_builder_v1", "oo:prod:1"),
      },
    ]);

    const active = await loadActiveMenuVersionForVendor("v1");
    expect(active?.id).toBe("mv_del");
    expect(active?.provider).toBe("deliverect");
  });

  it("Case 2 — manual routing ignores published Deliverect even if menuSource pointer is stale", async () => {
    mockVendorFindUnique.mockResolvedValue({
      menuSource: "deliverect",
      orderRoutingMode: "manual_dashboard",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_del",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("deliverect_menu_api_v1", "del-1"),
      },
    ]);

    const active = await loadActiveMenuVersionForVendor("v1");
    expect(active).toBeNull();
  });

  it("Case 3 — after Open Order publish, only OO menu is selected", async () => {
    mockVendorFindUnique.mockResolvedValue({
      menuSource: "open_order",
      orderRoutingMode: "manual_dashboard",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_del",
        state: MenuVersionState.archived,
        canonicalSnapshot: snapshot("deliverect_menu_api_v1", "del-1"),
      },
      {
        id: "mv_oo",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("open_order_builder_v1", "oo:prod:1"),
      },
    ]);

    const active = await loadActiveMenuVersionForVendor("v1");
    expect(active?.id).toBe("mv_oo");
    expect(active?.provider).toBe("open_order");
  });

  it("Case 4 — tablet → Deliverect selects Deliverect, not archived Open Order published sibling", async () => {
    mockVendorFindUnique.mockResolvedValue({
      menuSource: "deliverect",
      orderRoutingMode: "deliverect",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_oo",
        state: MenuVersionState.archived,
        canonicalSnapshot: snapshot("open_order_builder_v1", "oo:prod:1"),
      },
      {
        id: "mv_del",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("deliverect_menu_api_v1", "del-1"),
      },
    ]);

    const active = await loadActiveMenuVersionForVendor("v1");
    expect(active?.id).toBe("mv_del");
  });

  it("Case 5 — Square routing selects square_catalog_v1, not open_order_builder_v1", async () => {
    mockVendorFindUnique.mockResolvedValue({
      menuSource: "open_order",
      orderRoutingMode: "square",
    });
    mockMenuVersionFindMany.mockResolvedValue([
      {
        id: "mv_oo",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("open_order_builder_v1", "oo:prod:1"),
      },
      {
        id: "mv_sq",
        state: MenuVersionState.published,
        canonicalSnapshot: snapshot("square_catalog_v1", "sq:prod:1"),
      },
    ]);

    const active = await loadActiveMenuVersionForVendor("v1");
    expect(active?.id).toBe("mv_sq");
    expect(active?.provider).toBe("square");
  });
});
