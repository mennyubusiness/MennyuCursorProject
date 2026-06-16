import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canViewerCheckoutOnCartPage,
  isGroupParticipantCartView,
  type GroupOrderViewerContext,
} from "./group-order-viewer-context";

const hostCtx: GroupOrderViewerContext = {
  isGroupOrder: true,
  groupOrderSessionId: "gos_1",
  viewerRole: "host",
  viewerParticipantId: "p_host",
  hostParticipantId: "p_host",
  hostUserId: "user_1",
  canViewAllLines: true,
  canEditAllLines: true,
  canCheckout: true,
  joinCode: "123456",
};

const participantCtx: GroupOrderViewerContext = {
  isGroupOrder: true,
  groupOrderSessionId: "gos_1",
  viewerRole: "participant",
  viewerParticipantId: "p_alex",
  hostParticipantId: "p_host",
  hostUserId: "user_1",
  canViewAllLines: false,
  canEditAllLines: false,
  canCheckout: false,
  joinCode: null,
};

describe("canViewerCheckoutOnCartPage", () => {
  it("allows solo cart checkout", () => {
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: false,
        goStateView: undefined,
        viewerCtx: null,
      })
    ).toBe(true);
  });

  it("allows group host checkout", () => {
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: true,
        goStateView: "host",
        viewerCtx: hostCtx,
      })
    ).toBe(true);
  });

  it("denies group participant checkout even when cart validation passes", () => {
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: true,
        goStateView: "participant",
        viewerCtx: participantCtx,
      })
    ).toBe(false);
  });

  it("denies checkout for unknown group viewers", () => {
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: true,
        goStateView: "unknown",
        viewerCtx: { ...participantCtx, viewerRole: "unknown", canCheckout: false },
      })
    ).toBe(false);
  });

  it("does not treat participant actor mismatch as host checkout", () => {
    expect(
      isGroupParticipantCartView({ goStateActive: true, goStateView: "participant" })
    ).toBe(true);
    expect(
      canViewerCheckoutOnCartPage({
        goStateActive: true,
        goStateView: "participant",
        viewerCtx: hostCtx,
      })
    ).toBe(false);
  });
});

describe("group checkout permission wiring", () => {
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const cartMutationSrc = readFileSync(
    join(process.cwd(), "src/app/cart/CartPageMutationSync.tsx"),
    "utf8"
  );
  const cartMobileSrc = readFileSync(
    join(process.cwd(), "src/app/cart/CartPageMobileCheckoutBar.tsx"),
    "utf8"
  );
  const checkoutPageSrc = readFileSync(join(process.cwd(), "src/app/checkout/page.tsx"), "utf8");
  const checkoutPaymentSrc = readFileSync(
    join(process.cwd(), "src/app/checkout/CheckoutPaymentStep.tsx"),
    "utf8"
  );

  it("cart page gates checkout with goState host view, not groupActor role alone", () => {
    expect(cartPageSrc).toMatch(/canViewerCheckoutOnCartPage/);
    expect(cartPageSrc).toMatch(/isGroupParticipantCartView/);
    expect(cartPageSrc).toMatch(/allowCheckout=\{viewerCanCheckout\}/);
    expect(cartPageSrc).not.toMatch(/groupActor\?\.role === "participant"\)/);
  });

  it("cart live checkout actions hide payment CTA only for participant totals view", () => {
    expect(cartMutationSrc).toMatch(/viewerCanCheckout/);
    expect(cartMobileSrc).toMatch(/showParticipantTotalsOnly/);
    expect(cartMobileSrc).toMatch(/The host will check out when everyone is ready/);
    expect(cartMobileSrc).toMatch(/The host is checking out\. New changes are paused\./);
    expect(cartMobileSrc).not.toMatch(/showParticipantTotalsOnly \|\| !viewerCanCheckout/);
    expect(cartMutationSrc).not.toMatch(/Continue to checkout[\s\S]*showParticipantTotalsOnly/);
  });

  it("checkout SSR uses assertCartSessionAccess checkout mode before payment UI", () => {
    expect(checkoutPageSrc).toMatch(/assertCartSessionAccess\(cartId, sessionId/);
    expect(checkoutPageSrc).toMatch(/mode: "checkout"/);
    expect(checkoutPageSrc).not.toMatch(/resolveGroupCartActorForRead/);
    expect(checkoutPageSrc).not.toMatch(/CheckoutPaymentStep/);
    expect(checkoutPaymentSrc).toMatch(/PaymentElement/);
  });

  it("checkout page does not render Stripe before host authorization", () => {
    expect(checkoutPageSrc).toMatch(/if \(!access\.ok\)/);
    expect(checkoutPageSrc).toMatch(/<CheckoutForm/);
  });
});
