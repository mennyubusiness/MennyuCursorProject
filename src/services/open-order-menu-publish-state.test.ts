import { describe, expect, it } from "vitest";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import { buildOpenOrderCanonicalMenu } from "@/services/open-order-menu-publish.service";

describe("open-order menu publish fingerprint", () => {
  it("changes when draft menu content changes", () => {
    const categories = [{ id: "cat1", name: "Mains", sortOrder: 0, isVisible: true }];
    const items = [
      {
        id: "item1",
        name: "Tacos",
        description: null,
        priceCents: 1200,
        isAvailable: true,
        sortOrder: 0,
        deliverectCategoryId: "oo:cat:cat1",
        deliverectProductId: "oo:prod:item1",
        updatedAt: new Date(),
      },
    ];
    const modifierGroupsByItemId = new Map();

    const menuA = buildOpenOrderCanonicalMenu("vendor1", categories, items, modifierGroupsByItemId);
    const menuB = buildOpenOrderCanonicalMenu(
      "vendor1",
      categories,
      [{ ...items[0], priceCents: 1400 }],
      modifierGroupsByItemId
    );

    expect(payloadFingerprint(menuA)).not.toBe(payloadFingerprint(menuB));
  });
});
