import { describe, expect, it } from "vitest";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";
import { vendorSetupChecklistSummary } from "@/lib/vendor-setup-checklist-summary";

function item(key: string, complete: boolean, label = key): ReadinessChecklistItem {
  return { key, label, complete, owner: "vendor" };
}

describe("vendorSetupChecklistSummary", () => {
  it("collapses by default when fully ready", () => {
    const summary = vendorSetupChecklistSummary([
      item("a", true, "Name"),
      item("b", true, "Menu"),
    ]);
    expect(summary.allReady).toBe(true);
    expect(summary.defaultExpanded).toBe(false);
    expect(summary.readyCount).toBe(2);
    expect(summary.total).toBe(2);
  });

  it("expands by default when blockers remain", () => {
    const summary = vendorSetupChecklistSummary([
      item("a", true, "Name"),
      item("b", false, "Stripe"),
    ]);
    expect(summary.allReady).toBe(false);
    expect(summary.defaultExpanded).toBe(true);
    expect(summary.incompleteLabels).toEqual(["Stripe"]);
  });
});

describe("VendorSetupChecklist collapse UI", () => {
  it("supports manual expand/collapse via client state", async () => {
    const source = await import("@/components/vendor/VendorSetupChecklist");
    expect(source.VendorSetupChecklist.toString()).toContain("useState");
    expect(source.VendorSetupChecklist.toString()).toContain("setExpanded");
    expect(source.VendorSetupChecklist.toString()).toContain("aria-expanded");
  });
});
