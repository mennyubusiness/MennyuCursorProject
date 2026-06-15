import { describe, expect, it } from "vitest";
import {
  buildVendorMenuPublishGate,
  countMenuImportIssues,
  filterVendorMenuDisplayItems,
  formatLiveMenuStatusLine,
  groupFilteredMenuItemsByCategory,
  summarizeLiveMenuSections,
} from "./vendor-menu-page.helpers";

describe("summarizeLiveMenuSections", () => {
  it("counts categories, items, and availability", () => {
    const summary = summarizeLiveMenuSections([
      {
        id: "c1",
        name: "Mains",
        sortOrder: 0,
        items: [
          { id: "i1", isAvailable: true },
          { id: "i2", isAvailable: false },
        ] as never,
      },
      {
        id: "c2",
        name: "Drinks",
        sortOrder: 1,
        items: [{ id: "i3", isAvailable: true }] as never,
      },
    ]);

    expect(summary).toEqual({
      categoryCount: 2,
      itemCount: 3,
      availableCount: 2,
      unavailableCount: 1,
    });
  });
});

describe("formatLiveMenuStatusLine", () => {
  it("builds published summary copy", () => {
    const line = formatLiveMenuStatusLine(
      { categoryCount: 2, itemCount: 12, availableCount: 12, unavailableCount: 0 },
      true
    );
    expect(line).toContain("Published");
    expect(line).toContain("2 categories");
    expect(line).toContain("12 items");
    expect(line).toContain("12 available");
  });
});

describe("buildVendorMenuPublishGate", () => {
  it("blocks publish when no latest import", () => {
    const gate = buildVendorMenuPublishGate({
      hasLatestImport: false,
      publishEligibility: { canPublish: false, reasons: ["No draft"] },
      posConnected: true,
      canManage: true,
    });
    expect(gate.canPublish).toBe(false);
    expect(gate.disabledReasons[0]).toContain("No unpublished menu import");
  });

  it("blocks publish when POS is not connected", () => {
    const gate = buildVendorMenuPublishGate({
      hasLatestImport: true,
      publishEligibility: { canPublish: true, reasons: [] },
      posConnected: false,
      canManage: true,
    });
    expect(gate.canPublish).toBe(false);
    expect(gate.disabledReasons.some((r) => r.includes("POS is not connected"))).toBe(true);
  });

  it("allows publish when import, POS, and eligibility pass", () => {
    const gate = buildVendorMenuPublishGate({
      hasLatestImport: true,
      publishEligibility: { canPublish: true, reasons: [] },
      posConnected: true,
      canManage: true,
    });
    expect(gate.canPublish).toBe(true);
    expect(gate.disabledReasons).toEqual([]);
  });
});

describe("countMenuImportIssues", () => {
  it("counts blocking and warning issues excluding waived", () => {
    expect(
      countMenuImportIssues([
        { severity: "blocking", waived: false },
        { severity: "blocking", waived: true },
        { severity: "warning", waived: false },
      ])
    ).toEqual({ blocking: 1, warning: 1 });
  });
});

describe("filterVendorMenuDisplayItems", () => {
  const items = [
    {
      id: "1",
      categoryId: "c1",
      categoryName: "Mains",
      name: "Burger",
      description: "Classic",
      priceCents: 1200,
      imageUrl: null,
      isAvailable: true,
      hasMappingWarning: false,
    },
    {
      id: "2",
      categoryId: "c1",
      categoryName: "Mains",
      name: "Fries",
      description: null,
      priceCents: 500,
      imageUrl: null,
      isAvailable: false,
      hasMappingWarning: true,
    },
  ];

  it("filters by availability and warnings", () => {
    expect(filterVendorMenuDisplayItems(items, "", "unavailable")).toHaveLength(1);
    expect(filterVendorMenuDisplayItems(items, "", "warnings")).toHaveLength(1);
    expect(filterVendorMenuDisplayItems(items, "burger", "all")).toHaveLength(1);
  });

  it("groups filtered items by category", () => {
    const grouped = groupFilteredMenuItemsByCategory(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.items).toHaveLength(2);
  });
});
