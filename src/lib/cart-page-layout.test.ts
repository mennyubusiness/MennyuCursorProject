import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCartCheckoutCtaState } from "./cart-checkout-cta-state";
import { shouldShowJoinGroupOrderForm } from "./group-order-cart-empty-state";

const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
const actionsSrc = readFileSync(
  join(process.cwd(), "src/app/cart/cart-page-checkout-actions.tsx"),
  "utf8"
);
const joinActionSrc = readFileSync(
  join(process.cwd(), "src/app/cart/CartPageJoinGroupAction.tsx"),
  "utf8"
);

describe("cart page layout", () => {
  it("uses a two-column layout with sticky order summary on desktop", () => {
    expect(cartPageSrc).toMatch(/lg:grid lg:grid-cols-\[minmax\(0,1fr\)_min\(100%,20rem\)\]/);
    expect(cartPageSrc).toMatch(/lg:sticky lg:top-24/);
    expect(cartPageSrc).toMatch(/Review your items before checkout\./);
  });

  it("does not show checkout progress on the cart page", () => {
    expect(cartPageSrc).not.toMatch(/CheckoutProgress/);
  });

  it("does not render a dominant join-code form for solo carts with items", () => {
    expect(cartPageSrc).not.toMatch(/JoinGroupOrderByCodeForm/);
    expect(shouldShowJoinGroupOrderForm({ goStateActive: false, cartItemCount: 2 })).toBe(false);
  });

  it("keeps join group order available as a secondary action on empty states", () => {
    expect(cartPageSrc).toMatch(/CartPageJoinGroupAction/);
    expect(joinActionSrc).toMatch(/JoinGroupOrderByCodeModal/);
    expect(joinActionSrc).toMatch(/Join a group order/);
  });

  it("separates desktop summary checkout from mobile sticky checkout", () => {
    expect(cartPageSrc).toMatch(/surface="summary"/);
    expect(cartPageSrc).toMatch(/surface="mobile"/);
    expect(cartPageSrc).not.toMatch(/surface="desktop"/);
    expect(actionsSrc).toMatch(/hidden w-full items-center justify-center lg:inline-flex/);
    expect(actionsSrc).toMatch(/CartPageMobileCheckoutBar/);
    expect(actionsSrc).toMatch(/createPortal/);
  });

  it("does not duplicate the old bottom desktop checkout row", () => {
    expect(cartPageSrc).not.toMatch(/hidden sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-6/);
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
