import { describe, expect, it } from "vitest";
import {
  evaluatePoisonedNativeAvailability,
  patchNativeSnapshotAvailability,
  planNativeLiveReconciliation,
} from "@/services/native-open-order-availability-repair";

function nativeSnapshot(
  products: Array<{ id: string; available: boolean; name?: string }>
) {
  return {
    schemaVersion: 1 as const,
    vendorId: "v1",
    categories: [],
    products: products.map((p, i) => ({
      deliverectId: p.id,
      name: p.name ?? p.id,
      priceCents: 100,
      isAvailable: p.available,
      sortOrder: i,
      modifierGroupDeliverectIds: [],
    })),
    modifierGroupDefinitions: [],
    deliverect: { sourcePayloadKind: "open_order_builder_v1" as const },
  };
}

function lite(
  id: string,
  products: Array<{ id: string; available: boolean }>,
  at: string
) {
  return {
    id,
    publishedAt: new Date(at),
    createdAt: new Date(at),
    snapshot: nativeSnapshot(products),
  };
}

describe("evaluatePoisonedNativeAvailability", () => {
  it("E — restores A/B from last known-good and leaves C sold out", () => {
    const current = lite(
      "current",
      [
        { id: "oo:prod:A", available: false },
        { id: "oo:prod:B", available: false },
        { id: "oo:prod:C", available: false },
      ],
      "2026-08-19T00:00:00.000Z"
    );
    const lastGood = lite(
      "good",
      [
        { id: "oo:prod:A", available: true },
        { id: "oo:prod:B", available: true },
        { id: "oo:prod:C", available: false },
      ],
      "2026-06-30T00:00:00.000Z"
    );
    const poisoned = lite(
      "poison",
      [
        { id: "oo:prod:A", available: false },
        { id: "oo:prod:B", available: false },
        { id: "oo:prod:C", available: false },
      ],
      "2026-08-09T00:00:00.000Z"
    );

    const plan = evaluatePoisonedNativeAvailability({
      currentPublished: current,
      nativeHistory: [current, poisoned, lastGood],
    });

    expect(plan.repairType).toBe("repair_poisoned_native_availability");
    expect(plan.historicalSnapshotId).toBe("good");
    expect(plan.currentAvailable).toBe(0);
    expect(plan.historicalAvailable).toBe(2);
    expect(plan.changes).toEqual([
      { deliverectId: "oo:prod:A", name: "oo:prod:A", from: false, to: true },
      { deliverectId: "oo:prod:B", name: "oo:prod:B", from: false, to: true },
    ]);
  });

  it("F — does not auto-enable an intentional all-unavailable menu with no good history", () => {
    const current = lite(
      "current",
      [
        { id: "oo:prod:A", available: false },
        { id: "oo:prod:B", available: false },
      ],
      "2026-08-19T00:00:00.000Z"
    );
    const earlier = lite(
      "earlier",
      [
        { id: "oo:prod:A", available: false },
        { id: "oo:prod:B", available: false },
      ],
      "2026-06-01T00:00:00.000Z"
    );

    const plan = evaluatePoisonedNativeAvailability({
      currentPublished: current,
      nativeHistory: [current, earlier],
    });

    expect(plan.repairType).toBe("no_repair_needed");
    expect(plan.changes).toEqual([]);
  });

  it("does not repair when the live native catalog already has available items", () => {
    const current = lite(
      "current",
      [
        { id: "oo:prod:A", available: true },
        { id: "oo:prod:B", available: false },
      ],
      "2026-08-19T00:00:00.000Z"
    );
    const plan = evaluatePoisonedNativeAvailability({
      currentPublished: current,
      nativeHistory: [current],
    });
    expect(plan.repairType).toBe("no_repair_needed");
  });

  it("does not guess availability for products missing from last known-good", () => {
    const current = lite(
      "current",
      [
        { id: "oo:prod:A", available: false },
        { id: "oo:prod:NEW", available: false },
      ],
      "2026-08-19T00:00:00.000Z"
    );
    const lastGood = lite(
      "good",
      [{ id: "oo:prod:A", available: true }],
      "2026-06-30T00:00:00.000Z"
    );
    const plan = evaluatePoisonedNativeAvailability({
      currentPublished: current,
      nativeHistory: [current, lastGood],
    });
    expect(plan.repairType).toBe("no_repair_needed");
  });

  it("plans create vs availability update from live rows vs snapshot", () => {
    const plan = planNativeLiveReconciliation(
      [
        { deliverectId: "oo:prod:A", name: "A", isAvailable: true },
        { deliverectId: "oo:prod:B", name: "B", isAvailable: true },
        { deliverectId: "oo:prod:C", name: "C", isAvailable: false },
      ],
      [
        { deliverectProductId: "oo:prod:A", isAvailable: false },
        { deliverectProductId: "oo:prod:C", isAvailable: false },
      ]
    );
    expect(plan.wouldMutateLive).toBe(true);
    expect(plan.matchingLiveMenuItemCount).toBe(2);
    expect(plan.liveAvailableCount).toBe(0);
    expect(plan.snapshotAvailableCount).toBe(2);
    expect(plan.expectedAvailableItemCount).toBe(2);
    expect(plan.rowsToUpdateAvailability.map((r) => r.deliverectId)).toEqual(["oo:prod:A"]);
    expect(plan.rowsToCreate.map((r) => r.deliverectId)).toEqual(["oo:prod:B"]);
    expect(plan.actions.find((a) => a.deliverectId === "oo:prod:C")?.action).toBe("none");
  });

  it("patchNativeSnapshotAvailability updates only listed products", () => {
    const snapshot = nativeSnapshot([
      { id: "oo:prod:A", available: false, name: "A" },
      { id: "oo:prod:C", available: false, name: "C" },
    ]);
    const patched = patchNativeSnapshotAvailability(snapshot, [
      { deliverectId: "oo:prod:A", name: "A", from: false, to: true },
    ]) as { products: Array<{ deliverectId: string; isAvailable: boolean }> };
    expect(patched.products.find((p) => p.deliverectId === "oo:prod:A")?.isAvailable).toBe(true);
    expect(patched.products.find((p) => p.deliverectId === "oo:prod:C")?.isAvailable).toBe(false);
  });
});
