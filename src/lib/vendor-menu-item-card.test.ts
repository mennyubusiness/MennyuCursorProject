import { describe, expect, it } from "vitest";
import { handleMenuItemCardKeyDown } from "@/lib/menu-item-card-keydown";
import { resolveCartCheckoutCtaState } from "@/lib/cart-checkout-cta-state";

describe("handleMenuItemCardKeyDown", () => {
  it("activates on Enter and Space when enabled", () => {
    let count = 0;
    const onActivate = () => {
      count += 1;
    };

    handleMenuItemCardKeyDown({ key: "Enter", preventDefault: () => {} } as never, onActivate, false);
    handleMenuItemCardKeyDown({ key: " ", preventDefault: () => {} } as never, onActivate, false);

    expect(count).toBe(2);
  });

  it("does not activate when disabled", () => {
    let count = 0;
    handleMenuItemCardKeyDown(
      { key: "Enter", preventDefault: () => {} } as never,
      () => {
        count += 1;
      },
      true
    );
    expect(count).toBe(0);
  });
});

describe("resolveCartCheckoutCtaState", () => {
  it("enables checkout with shared summary formatting", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: true,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 2,
      subtotalCents: 1899,
    });

    expect(state.checkoutEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Proceed to checkout");
    expect(state.summaryTitle).toBe("2 items · $18.99");
  });

  it("returns blocked label when validation fails", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: false,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 1,
      subtotalCents: 999,
    });

    expect(state.checkoutEnabled).toBe(false);
    expect(state.blockedLabel).toBe("Fix items above to continue");
    expect(state.primaryLabel).toBe("Fix items above to continue");
    expect(state.summarySubtitle).toBe("Fix items above to continue");
  });
});
