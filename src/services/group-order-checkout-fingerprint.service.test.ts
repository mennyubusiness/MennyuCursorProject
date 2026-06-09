import { describe, expect, it } from "vitest";
import {
  formatGroupCheckoutFingerprintPayload,
  hashGroupCheckoutFingerprintPayload,
  type GroupCheckoutFingerprintParts,
} from "./group-order-checkout-fingerprint.service";

function baseParts(over: Partial<GroupCheckoutFingerprintParts> = {}): GroupCheckoutFingerprintParts {
  const t = new Date("2026-06-04T12:00:00.000Z");
  return {
    groupOrderSessionId: "gos_1",
    sessionStatus: "locked_checkout",
    cartId: "cart_1",
    cartUpdatedAt: t,
    lines: [
      {
        id: "line_1",
        menuItemId: "mi_1",
        quantity: 2,
        priceCents: 500,
        specialInstructions: null,
        groupOrderParticipantId: "part_host",
        updatedAt: t,
        selections: [{ modifierOptionId: "opt_1", quantity: 1, updatedAt: t }],
      },
    ],
    ...over,
  };
}

describe("group checkout fingerprint payload", () => {
  it("is stable for identical cart content", () => {
    const p = baseParts();
    const a = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(p));
    const b = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(p));
    expect(a).toBe(b);
  });

  it("changes when quantity changes", () => {
    const a = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(baseParts()));
    const b = hashGroupCheckoutFingerprintPayload(
      formatGroupCheckoutFingerprintPayload(
        baseParts({
          lines: [{ ...baseParts().lines[0]!, quantity: 3 }],
        })
      )
    );
    expect(a).not.toBe(b);
  });

  it("changes when participant attribution changes", () => {
    const a = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(baseParts()));
    const b = hashGroupCheckoutFingerprintPayload(
      formatGroupCheckoutFingerprintPayload(
        baseParts({
          lines: [{ ...baseParts().lines[0]!, groupOrderParticipantId: "part_alex" }],
        })
      )
    );
    expect(a).not.toBe(b);
  });

  it("changes when modifier selection changes", () => {
    const t = new Date("2026-06-04T12:00:00.000Z");
    const a = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(baseParts()));
    const b = hashGroupCheckoutFingerprintPayload(
      formatGroupCheckoutFingerprintPayload(
        baseParts({
          lines: [
            {
              ...baseParts().lines[0]!,
              selections: [{ modifierOptionId: "opt_2", quantity: 1, updatedAt: t }],
            },
          ],
        })
      )
    );
    expect(a).not.toBe(b);
  });

  it("changes when line count changes", () => {
    const t = new Date("2026-06-04T12:00:00.000Z");
    const a = hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(baseParts()));
    const b = hashGroupCheckoutFingerprintPayload(
      formatGroupCheckoutFingerprintPayload(
        baseParts({
          lines: [
            ...baseParts().lines,
            {
              id: "line_2",
              menuItemId: "mi_2",
              quantity: 1,
              priceCents: 300,
              specialInstructions: "no onions",
              groupOrderParticipantId: "part_alex",
              updatedAt: t,
              selections: [],
            },
          ],
        })
      )
    );
    expect(a).not.toBe(b);
  });
});
