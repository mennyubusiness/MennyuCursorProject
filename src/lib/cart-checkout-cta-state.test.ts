import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCartCheckoutCtaState } from "@/lib/cart-checkout-cta-state";
import { canViewerCheckoutOnCartPage } from "@/lib/group-order-viewer-context";

describe("resolveCartCheckoutCtaState", () => {
  it("enables checkout for solo guest cart with valid items", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: true,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 2,
      subtotalCents: 2400,
    });

    expect(state.checkoutEnabled).toBe(true);
    expect(state.primaryLabel).toBe("Checkout");
  });

  it("keeps checkout visible but disabled when validation fails", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: false,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 1,
      subtotalCents: 1200,
    });

    expect(state.checkoutEnabled).toBe(false);
    expect(state.primaryLabel).toBe("Fix items above to continue");
  });

  it("does not treat inactive solo carts as participant-only messaging", () => {
    const state = resolveCartCheckoutCtaState({
      viewerCanCheckout: true,
      canCheckout: true,
      isRevalidating: false,
      isSyncingCart: false,
      groupSubmitted: false,
      showParticipantTotalsOnly: false,
      sessionLockedCheckout: false,
      itemCount: 1,
      subtotalCents: 900,
    });

    expect(state.showParticipantMessage).toBe(false);
  });
});

describe("solo cart checkout CTA regression", () => {
  it("allows checkout when group state is inactive even if viewer ctx denies checkout", () => {
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: false,
        goStateView: undefined,
        viewerCtx: {
          isGroupOrder: true,
          groupOrderSessionId: "gos_1",
          viewerRole: "unknown",
          viewerParticipantId: null,
          hostParticipantId: "p_host",
          hostUserId: "user_1",
          canViewAllLines: false,
          canEditAllLines: false,
          canCheckout: false,
          joinCode: null,
        },
      })
    ).toBe(true);
  });

  it("CartPageMobileCheckoutBar keeps checkout CTA for non-participant views", () => {
    const mobileBarSrc = readFileSync(
      join(process.cwd(), "src/app/cart/CartPageMobileCheckoutBar.tsx"),
      "utf8"
    );
    expect(mobileBarSrc).toMatch(/if \(showParticipantTotalsOnly\) \{/);
    expect(mobileBarSrc).not.toMatch(/showParticipantTotalsOnly \|\| !viewerCanCheckout/);
    expect(mobileBarSrc).toMatch(/primaryLabel="Checkout"/);
  });

  it("CartPageMutationSync rejects stale lifecycle snapshots", () => {
    const syncSrc = readFileSync(
      join(process.cwd(), "src/app/cart/CartPageMutationSync.tsx"),
      "utf8"
    );
    expect(syncSrc).toMatch(/shouldAcceptCartSnapshot/);
  });
});
