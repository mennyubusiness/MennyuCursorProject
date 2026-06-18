import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveGroupCartEmptyState,
  shouldShowJoinGroupOrderForm,
} from "./group-order-cart-empty-state";
import { resolveCartCheckoutCtaState } from "./cart-checkout-cta-state";

describe("group-order-cart-empty-state", () => {
  it("host with zero items → host_group_empty", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: true,
        goView: "host",
      })
    ).toBe("host_group_empty");
  });

  it("participant with zero own items → participant_group_empty", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: true,
        goView: "participant",
      })
    ).toBe("participant_group_empty");
  });

  it("solo empty cart without group session", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: false,
        goView: null,
      })
    ).toBe("solo_empty");
  });

  it("hides join form when group session active", () => {
    expect(shouldShowJoinGroupOrderForm({ goStateActive: true, cartItemCount: 0 })).toBe(false);
  });

  it("hides join form for solo carts that already have items", () => {
    expect(shouldShowJoinGroupOrderForm({ goStateActive: false, cartItemCount: 2 })).toBe(false);
  });

  it("shows join form for empty solo carts without active group", () => {
    expect(shouldShowJoinGroupOrderForm({ goStateActive: false, cartItemCount: 0 })).toBe(true);
  });

  it("group cart with items → has_items", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 2,
        goStateActive: true,
        goView: "host",
      })
    ).toBe("has_items");
  });
});

describe("solo cart checkout CTA regression", () => {
  it("solo cart with items enables Proceed to checkout", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: true,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 2,
      subtotalCents: 2350,
    });
    expect(state.checkoutEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Proceed to checkout");
  });
});
