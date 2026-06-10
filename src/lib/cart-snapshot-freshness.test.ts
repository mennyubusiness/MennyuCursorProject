import { beforeEach, describe, expect, it } from "vitest";
import type { Cart } from "@/domain/types";
import { enrichCartUpdatedDetail } from "@/lib/cart-client-sync";
import {
  resetCartSnapshotFreshnessForTests,
  shouldAcceptApiCartPayload,
  shouldAcceptCartSnapshot,
} from "@/lib/cart-snapshot-freshness";
import { mergeAcceptedCartSnapshotMeta } from "@/lib/cart-snapshot-freshness";

function cartWithItems(count = 1): Cart {
  return {
    id: "cart_1",
    podId: "pod_a",
    sessionId: "sess_1",
    items: Array.from({ length: count }, (_, i) => ({
      id: `line_${i}`,
      quantity: 1,
      priceCents: 500,
      vendorId: "vendor_1",
      vendorName: "Vendor",
      menuItemId: "item_1",
      specialInstructions: null,
    })) as Cart["items"],
    groups: [],
    subtotalCents: count * 500,
  };
}

function emptyCart(): Cart {
  return {
    id: "cart_1",
    podId: "pod_a",
    sessionId: "sess_1",
    items: [],
    groups: [],
    subtotalCents: 0,
  };
}

function emit(detail: Parameters<typeof enrichCartUpdatedDetail>[0]) {
  return enrichCartUpdatedDetail(detail);
}

describe("cart snapshot freshness", () => {
  beforeEach(() => {
    resetCartSnapshotFreshnessForTests();
  });

  it("rejects delayed group-order-ended empty snapshot after newer add snapshot", () => {
    const start = emit({
      cart: emptyCart(),
      source: "group-order-start",
    });
    let last = mergeAcceptedCartSnapshotMeta(null, start);

    const remove = emit({
      cart: emptyCart(),
      source: "vendor-menu",
    });
    last = mergeAcceptedCartSnapshotMeta(last, remove);

    const end = emit({
      cart: emptyCart(),
      source: "group-order-ended",
    });
    expect(shouldAcceptCartSnapshot(end, last)).toBe(true);
    last = mergeAcceptedCartSnapshotMeta(last, end);

    const add = emit({
      cart: cartWithItems(1),
      source: "vendor-menu",
    });
    expect(shouldAcceptCartSnapshot(add, last)).toBe(true);
    last = mergeAcceptedCartSnapshotMeta(last, add);

    const staleEnd = {
      ...end,
      clientSequence: (add.clientSequence ?? 0) + 1,
      endAtMutationGeneration: end.endAtMutationGeneration,
      cart: emptyCart(),
    };
    expect(shouldAcceptCartSnapshot(staleEnd, last)).toBe(false);
  });

  it("rejects delayed API empty payload after newer mutation snapshot", () => {
    const add = emit({
      cart: cartWithItems(1),
      source: "vendor-menu",
    });
    const last = mergeAcceptedCartSnapshotMeta(null, add);

    expect(shouldAcceptApiCartPayload({ cart: null }, last)).toBe(false);
    expect(shouldAcceptApiCartPayload({ cart: emptyCart() }, last)).toBe(false);
    expect(shouldAcceptApiCartPayload({ cart: cartWithItems(1) }, last)).toBe(true);
  });

  it("accepts newer explicit group-order-ended when no later mutation happened", () => {
    const add = emit({
      cart: cartWithItems(2),
      source: "vendor-menu",
    });
    let last = mergeAcceptedCartSnapshotMeta(null, add);

    const end = emit({
      cart: emptyCart(),
      source: "group-order-ended",
    });
    expect(shouldAcceptCartSnapshot(end, last)).toBe(true);
    last = mergeAcceptedCartSnapshotMeta(last, end);
    expect(last.itemCount).toBe(0);
  });

  it("rejects older client sequence snapshots", () => {
    const first = emit({ cart: cartWithItems(1), source: "vendor-menu" });
    const last = mergeAcceptedCartSnapshotMeta(null, first);

    const stale = {
      ...first,
      clientSequence: (first.clientSequence ?? 1) - 1,
      cart: emptyCart(),
    };
    expect(shouldAcceptCartSnapshot(stale, last)).toBe(false);
  });

  it("accepts mutation remove snapshot that clears items", () => {
    const add = emit({ cart: cartWithItems(1), source: "vendor-menu" });
    const last = mergeAcceptedCartSnapshotMeta(null, add);

    const remove = emit({ cart: emptyCart(), source: "vendor-menu" });
    expect(shouldAcceptCartSnapshot(remove, last)).toBe(true);
  });
});

describe("group end dedupe wiring", () => {
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const endSyncSrc = readFileSync(
    join(process.cwd(), "src/lib/group-order-end-sync.ts"),
    "utf8"
  );
  const quickCartSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const vendorSrc = readFileSync(
    join(process.cwd(), "src/components/vendor-menu/VendorMenuCartContext.tsx"),
    "utf8"
  );

  it("Quick Cart and VendorMenuCartContext use stale snapshot guard", () => {
    expect(quickCartSrc).toContain("shouldAcceptCartSnapshot");
    expect(quickCartSrc).toContain("shouldAcceptApiCartPayload");
    expect(vendorSrc).toContain("shouldAcceptCartSnapshot");
    expect(vendorSrc).toContain("lastAcceptedMetaRef");
  });

  it("group end sync dedupes repeated ended session dispatches", () => {
    expect(endSyncSrc).toContain("wasGroupOrderEndAlreadySynced");
    expect(endSyncSrc).toContain("endedSessionId");
  });
});
