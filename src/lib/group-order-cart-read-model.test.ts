import { describe, expect, it } from "vitest";
import {
  buildGroupOrderCartReadModel,
  canEditGroupCartLine,
  GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT,
  tipCentsForPercentPreview,
} from "./group-order-cart-read-model";

describe("buildGroupOrderCartReadModel", () => {
  it("splits illustrative tip pro-rata by food subtotal (matches checkout default % on total food)", () => {
    const host = { id: "h", displayName: "Host", isHost: true };
    const a = { id: "a", displayName: "Alex", isHost: false };
    const lines = [
      { id: "1", priceCents: 1000, quantity: 1, groupOrderParticipantId: "h" },
      { id: "2", priceCents: 3000, quantity: 1, groupOrderParticipantId: "a" },
    ];
    const m = buildGroupOrderCartReadModel(lines, [host, a])!;
    expect(m.groupFoodSubtotalCents).toBe(4000);
    const expectedTotalTip = tipCentsForPercentPreview(4000, GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT);
    expect(m.illustrativeTotalTipCents).toBe(expectedTotalTip);
    const hostRow = m.participantRows.find((r) => r.participantId === "h")!;
    const alexRow = m.participantRows.find((r) => r.participantId === "a")!;
    expect(hostRow.subtotalCents).toBe(1000);
    expect(alexRow.subtotalCents).toBe(3000);
    expect(hostRow.illustrativeTipShareCents + alexRow.illustrativeTipShareCents).toBe(expectedTotalTip);
  });

  it("attributes null participant lines to host", () => {
    const host = { id: "h", displayName: "Host", isHost: true };
    const m = buildGroupOrderCartReadModel(
      [{ id: "1", priceCents: 500, quantity: 2, groupOrderParticipantId: null }],
      [host]
    )!;
    expect(m.participantRows[0]!.subtotalCents).toBe(1000);
  });
});

describe("canEditGroupCartLine", () => {
  it("denies all when locked", () => {
    expect(
      canEditGroupCartLine({
        sessionLocked: true,
        viewerIsHost: true,
        viewerParticipantId: "h",
        hostParticipantId: "h",
        lineGroupOrderParticipantId: "h",
      })
    ).toBe(false);
  });

  it("allows host to edit any line when unlocked", () => {
    expect(
      canEditGroupCartLine({
        sessionLocked: false,
        viewerIsHost: true,
        viewerParticipantId: "h",
        hostParticipantId: "h",
        lineGroupOrderParticipantId: "other",
      })
    ).toBe(true);
  });

  it("allows participant only on own lines", () => {
    expect(
      canEditGroupCartLine({
        sessionLocked: false,
        viewerIsHost: false,
        viewerParticipantId: "a",
        hostParticipantId: "h",
        lineGroupOrderParticipantId: "a",
      })
    ).toBe(true);
    expect(
      canEditGroupCartLine({
        sessionLocked: false,
        viewerIsHost: false,
        viewerParticipantId: "a",
        hostParticipantId: "h",
        lineGroupOrderParticipantId: "b",
      })
    ).toBe(false);
  });
});
