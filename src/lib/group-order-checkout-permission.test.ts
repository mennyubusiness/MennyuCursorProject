import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canAccessPaymentStep,
  GROUP_PARTICIPANT_CHECKOUT_WAITING_MESSAGE,
  GROUP_PARTICIPANT_ORDER_REDIRECT_MESSAGE,
  groupParticipantWaitingCopy,
} from "./group-order-checkout-permission";
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

describe("canAccessPaymentStep", () => {
  it("allows solo cart checkout", () => {
    expect(
      canAccessPaymentStep({
        isGroupOrder: false,
        actorRole: "solo",
      })
    ).toBe(true);
  });

  it("allows group host checkout", () => {
    expect(
      canAccessPaymentStep({
        isGroupOrder: true,
        actorRole: "host",
        goStateView: "host",
        groupSessionActive: true,
      })
    ).toBe(true);
  });

  it("denies group participant payment access", () => {
    expect(
      canAccessPaymentStep({
        isGroupOrder: true,
        actorRole: "participant",
        goStateView: "participant",
        groupSessionActive: true,
      })
    ).toBe(false);
  });

  it("denies payment when active group state is not host view", () => {
    expect(
      canAccessPaymentStep({
        isGroupOrder: true,
        actorRole: "host",
        goStateView: "participant",
        groupSessionActive: true,
      })
    ).toBe(false);
  });
});

describe("groupParticipantWaitingCopy", () => {
  it("shows waiting copy while host checks out", () => {
    const copy = groupParticipantWaitingCopy(true);
    expect(copy).toContain(GROUP_PARTICIPANT_CHECKOUT_WAITING_MESSAGE);
    expect(copy).toContain(GROUP_PARTICIPANT_ORDER_REDIRECT_MESSAGE);
  });

  it("shows pre-checkout copy before host locks checkout", () => {
    expect(groupParticipantWaitingCopy(false)).toContain("The host will check out when everyone is ready.");
  });
});

describe("group checkout permission wiring", () => {
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const cartMutationSrc = readFileSync(
    join(process.cwd(), "src/app/cart/CartPageMutationSync.tsx"),
    "utf8"
  );
  const cartActionsSrc = readFileSync(
    join(process.cwd(), "src/app/cart/cart-page-checkout-actions.tsx"),
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
    expect(cartActionsSrc).toMatch(/showParticipantTotalsOnly/);
    expect(cartActionsSrc).toMatch(/groupParticipantWaitingCopy/);
    expect(cartActionsSrc).not.toMatch(/showParticipantTotalsOnly \|\| !viewerCanCheckout/);
    expect(cartMutationSrc).not.toMatch(/Continue to checkout[\s\S]*showParticipantTotalsOnly/);
  });

  it("checkout SSR passes participant markers before payment UI", () => {
    expect(checkoutPageSrc).toMatch(/readGroupOrderParticipantMarkers/);
    expect(checkoutPageSrc).toMatch(/participantMarkers/);
    expect(checkoutPageSrc).toMatch(/groupParticipantCheckoutRedirectPath/);
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
