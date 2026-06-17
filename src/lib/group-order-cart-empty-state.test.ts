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

  it("cart page renders summary checkout and resilient checkout gate", () => {
    const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
    const syncSrc = readFileSync(join(process.cwd(), "src/app/cart/CartPageMutationSync.tsx"), "utf8");
    const actionsSrc = readFileSync(
      join(process.cwd(), "src/app/cart/cart-page-checkout-actions.tsx"),
      "utf8"
    );

    expect(cartPageSrc).toMatch(/surface="summary"/);
    expect(cartPageSrc).toMatch(/serverItemCount=\{displayItems\.reduce/);
    expect(cartPageSrc).toMatch(/Join a group order with a code/);
    expect(cartPageSrc).not.toMatch(/JoinGroupOrderByCodeForm visible=\{showJoinCodeForm\} className="mb-4"/);
    expect(syncSrc).toMatch(/serverItemCount/);
    expect(syncSrc).toMatch(/shouldAcceptApiCartPayload/);
    expect(actionsSrc).toMatch(/CartPageSummaryCheckoutActions/);
    expect(actionsSrc).toMatch(/Proceed to checkout/);
  });
});
