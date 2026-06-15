import { describe, expect, it } from "vitest";
import { deliverectPluAuditFixture } from "./__fixtures__/deliverect-plu-audit.fixture";
import {
  collectOperationalModifierPlus,
  collectOperationalProductPlus,
  findDuplicateModifierPlusInSameGroup,
  findDuplicateOperationalProductPlus,
  findDuplicatePluGroups,
  findProductModifierPluOverlap,
  isDeliverectVariantParentPlaceholderPlu,
} from "./deliverect-menu-integrity.service";

describe("findDuplicatePluGroups", () => {
  it("returns empty when all PLUs unique", () => {
    const m = findDuplicatePluGroups([
      { key: "A", id: "1" },
      { key: "B", id: "2" },
      { key: "C", id: "3" },
    ]);
    expect(m.size).toBe(0);
  });

  it("treats trimmed PLUs as same key", () => {
    const m = findDuplicatePluGroups([
      { key: "A", id: "1" },
      { key: "  A  ", id: "3" },
    ]);
    expect(m.get("A")).toEqual(["1", "3"]);
  });

  it("ignores empty keys", () => {
    const m = findDuplicatePluGroups([
      { key: "", id: "1" },
      { key: null, id: "2" },
      { key: "X", id: "3" },
    ]);
    expect(m.size).toBe(0);
  });

  it("detects triple duplicate", () => {
    const m = findDuplicatePluGroups([
      { key: "dup", id: "a" },
      { key: "dup", id: "b" },
      { key: "dup", id: "c" },
    ]);
    expect(m.get("dup")).toEqual(["a", "b", "c"]);
  });
});

describe("isDeliverectVariantParentPlaceholderPlu", () => {
  it("detects ###PRNT sentinel suffix", () => {
    expect(isDeliverectVariantParentPlaceholderPlu("P-BRGR-1###PRNT")).toBe(true);
    expect(isDeliverectVariantParentPlaceholderPlu("P-BRGR-1")).toBe(false);
  });
});

describe("Deliverect PLU audit fixture", () => {
  const operationalIds = new Set(deliverectPluAuditFixture.operationalMenuItemIds);

  it("does not warn duplicate_product_plu when only one operational row owns P-BRGR-1", () => {
    const dupes = findDuplicateOperationalProductPlus(deliverectPluAuditFixture.productRows, operationalIds);
    expect(dupes.has("P-BRGR-1")).toBe(false);
  });

  it("excludes ###PRNT parent placeholder rows from product duplicate scan", () => {
    const dupes = findDuplicateOperationalProductPlus(
      [
        ...deliverectPluAuditFixture.productRows,
        { id: "parent-only", name: "Parent", deliverectPlu: "P-BRGR-1###PRNT" },
      ],
      new Set(["parent-only", "item-burger-active"])
    );
    expect(dupes.has("P-BRGR-1###PRNT")).toBe(false);
    expect(dupes.has("P-BRGR-1")).toBe(false);
  });

  it("does not warn duplicate_modifier_plu for TOMAT/ONION reused across separate groups", () => {
    const dupes = findDuplicateModifierPlusInSameGroup(deliverectPluAuditFixture.modifierRows);
    const pluGroups = dupes.map((d) => d.plu);
    expect(pluGroups).not.toContain("TOMAT");
    expect(pluGroups).not.toContain("ONION");
    expect(pluGroups).not.toContain("DLX-1");
  });

  it("still warns when two operational products share the same PLU", () => {
    const dupes = findDuplicateOperationalProductPlus(deliverectPluAuditFixture.productRows, new Set(["item-ambiguous-a", "item-ambiguous-b"]));
    expect(dupes.get("AMBIG-1")).toEqual(["item-ambiguous-a", "item-ambiguous-b"]);
  });

  it("still warns when duplicate modifier PLUs exist in the same group", () => {
    const dupes = findDuplicateModifierPlusInSameGroup(deliverectPluAuditFixture.modifierRows);
    const ambiguous = dupes.find((d) => d.plu === "PICKL");
    expect(ambiguous?.groupName).toBe("Ambiguous group");
    expect(ambiguous?.optionIds).toEqual(["opt-dlx-dup-a", "opt-dlx-dup-b"]);
  });

  it("treats product/modifier PLU reuse as overlap info, not duplicate warnings", () => {
    const productPlus = collectOperationalProductPlus(deliverectPluAuditFixture.productRows, operationalIds);
    const modifierPlus = collectOperationalModifierPlus(deliverectPluAuditFixture.modifierRows);
    expect(findProductModifierPluOverlap(productPlus, modifierPlus)).toContain("DLX-1");
    expect(findDuplicateOperationalProductPlus(deliverectPluAuditFixture.productRows, operationalIds).has("DLX-1")).toBe(
      false
    );
    expect(findDuplicateModifierPlusInSameGroup(deliverectPluAuditFixture.modifierRows).some((d) => d.plu === "DLX-1")).toBe(
      false
    );
  });

  it("ignores retired modifier rows when scoping duplicate modifier PLUs", () => {
    const dupes = findDuplicateModifierPlusInSameGroup(deliverectPluAuditFixture.modifierRows);
    expect(dupes.some((d) => d.groupName === "Burger toppings" && d.plu === "PICKL")).toBe(false);
  });
});

describe("legacy global scan would have false positives", () => {
  it("shows retired product rows and cross-group modifiers inflated duplicate counts", () => {
    const allProducts = findDuplicatePluGroups(
      deliverectPluAuditFixture.productRows.map((r) => ({ key: r.deliverectPlu, id: r.id }))
    );
    expect(allProducts.get("P-BRGR-1")?.length).toBeGreaterThan(1);

    const allModifiers = findDuplicatePluGroups(
      deliverectPluAuditFixture.modifierRows.map((r) => ({ key: r.plu, id: r.optionId }))
    );
    expect(allModifiers.get("TOMAT")?.length).toBeGreaterThan(1);
    expect(allModifiers.get("ONION")?.length).toBeGreaterThan(1);
    expect(allModifiers.get("DLX-1")?.length).toBeGreaterThan(1);
  });
});
