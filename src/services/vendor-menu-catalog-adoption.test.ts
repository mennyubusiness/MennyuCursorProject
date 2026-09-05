import { MenuVersionState } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  pickAdoptedProviderCatalog,
  providerAdoptionWouldMutate,
  providerOriginsAmong,
} from "@/services/vendor-menu-catalog-adoption";

function square(id: string, state: MenuVersionState, at: string) {
  return {
    id,
    state,
    publishedAt: new Date(at),
    createdAt: new Date(at),
    canonicalSnapshot: {
      schemaVersion: 1,
      vendorId: "v1",
      categories: [],
      products: [
        {
          deliverectId: "sq:prod:1",
          name: "Bowl",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
      ],
      modifierGroupDefinitions: [],
      deliverect: { sourcePayloadKind: "square_catalog_v1" },
    },
  };
}

function deliverect(id: string, state: MenuVersionState, at: string) {
  return {
    id,
    state,
    publishedAt: new Date(at),
    createdAt: new Date(at),
    canonicalSnapshot: {
      schemaVersion: 1,
      vendorId: "v1",
      categories: [],
      products: [
        {
          deliverectId: "del-1",
          name: "Burger",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
      ],
      modifierGroupDefinitions: [],
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    },
  };
}

describe("pickAdoptedProviderCatalog", () => {
  it("prefers the newest published provider catalog over an older archived one", () => {
    const rows = [
      square("sq_new_arch", MenuVersionState.archived, "2026-08-01T00:00:00.000Z"),
      square("sq_pub", MenuVersionState.published, "2026-07-01T00:00:00.000Z"),
    ];
    expect(pickAdoptedProviderCatalog(rows)?.id).toBe("sq_pub");
  });

  it("falls back to newest archived provider catalog when none are published", () => {
    const rows = [
      square("sq_new", MenuVersionState.archived, "2026-08-01T00:00:00.000Z"),
      square("sq_old", MenuVersionState.archived, "2026-06-01T00:00:00.000Z"),
    ];
    expect(pickAdoptedProviderCatalog(rows)?.id).toBe("sq_new");
  });

  it("detects multiple provider origins as ambiguous for auto-adopt", () => {
    const rows = [
      square("sq", MenuVersionState.archived, "2026-08-01T00:00:00.000Z"),
      deliverect("del", MenuVersionState.archived, "2026-07-01T00:00:00.000Z"),
    ];
    expect(providerOriginsAmong(rows).sort()).toEqual(["deliverect", "square"]);
  });
});

describe("providerAdoptionWouldMutate", () => {
  it("is false when the selected catalog is already live and items need no restore", () => {
    expect(
      providerAdoptionWouldMutate({
        menuSourceAligned: true,
        selectedCurrentlyArchived: false,
        menuItemsThatWouldBeRestored: 0,
      })
    ).toBe(false);
  });

  it("is true when an archived catalog would be unarchived or items restored", () => {
    expect(
      providerAdoptionWouldMutate({
        menuSourceAligned: true,
        selectedCurrentlyArchived: true,
        menuItemsThatWouldBeRestored: 0,
      })
    ).toBe(true);
    expect(
      providerAdoptionWouldMutate({
        menuSourceAligned: true,
        selectedCurrentlyArchived: false,
        menuItemsThatWouldBeRestored: 4,
      })
    ).toBe(true);
  });
});
