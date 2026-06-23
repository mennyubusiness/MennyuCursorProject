import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const checkoutPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const cartMutationSrc = readFileSync(join(dir, "../cart/CartPageMutationSync.tsx"), "utf8");
const checkoutFormSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
const checkoutPaymentSrc = readFileSync(join(dir, "CheckoutPaymentStep.tsx"), "utf8");
const cartCheckoutCtaSrc = readFileSync(join(dir, "../../lib/cart-checkout-cta-state.ts"), "utf8");
const checkoutPlaceOrderCtaSrc = readFileSync(
  join(dir, "../../lib/checkout-place-order-cta-state.ts"),
  "utf8"
);
const orderServiceSrc = readFileSync(
  join(dir, "../../services/order.service.ts"),
  "utf8"
);
const postPaymentSrc = readFileSync(
  join(dir, "../../services/post-payment.service.ts"),
  "utf8"
);
const issuesWorkbenchSrc = readFileSync(
  join(dir, "../admin/(dashboard)/exceptions/IssuesWorkbench.tsx"),
  "utf8"
);
describe("checkout cart validation gate", () => {
  it("validates cart before rendering checkout", () => {
    expect(checkoutPageSrc).toMatch(/validateCartItemsForDisplay/);
    expect(checkoutPageSrc).toMatch(/buildCartForValidationFromDisplayCart/);
    expect(checkoutPageSrc).toMatch(/redirect\(`\/cart\?error=/);
  });
});

describe("cart live checkout gate", () => {
  it("applies vendor-menu and quick-cart snapshots on the cart page", () => {
    expect(cartMutationSrc).toMatch(/shouldApplyCartSnapshot\(detail, "cart-page"/);
    expect(cartMutationSrc).not.toMatch(/detail\?\.source !== "cart-page"/);
  });

  it("blocks continue while revalidation or cart sync is pending", () => {
    expect(cartCheckoutCtaSrc).toMatch(/!input\.isRevalidating/);
    expect(cartCheckoutCtaSrc).toMatch(/!input\.isSyncingCart/);
    expect(cartCheckoutCtaSrc).toMatch(/input\.viewerCanCheckout/);
  });

  it("marks cart invalid when revalidation fails", () => {
    expect(cartMutationSrc).toMatch(/REVALIDATION_FAILED/);
  });
});

describe("checkout payment lifecycle guards", () => {
  it("revalidates cart before reusing pending_payment order for same cart", () => {
    expect(orderServiceSrc).toMatch(/sourceCartId: input\.cartId, status: "pending_payment"/);
    expect(orderServiceSrc).toMatch(/evaluatePendingOrderReuse/);
    expect(orderServiceSrc).toMatch(/validateCartForOrder/);
  });

  it("inline Stripe success navigates with payment=success for reconcile", () => {
    expect(checkoutFormSrc).toMatch(/payment:\s*"success"/);
  });

  it("does not clear cart client-side before payment confirms", () => {
    expect(checkoutPaymentSrc).not.toMatch(/clearCartOnServerAndNotifyClient/);
  });

  it("uses blocked payment CTA state for Stripe readiness", () => {
    expect(checkoutPaymentSrc).toMatch(/resolveCheckoutPaymentCtaState/);
    expect(checkoutPlaceOrderCtaSrc).toMatch(/Complete payment details/);
  });

  it("uses blocked payment CTA state for in-page place-order action", () => {
    expect(checkoutPaymentSrc).toMatch(/resolveCheckoutPaymentCtaState/);
    expect(checkoutPaymentSrc).toMatch(/paymentCta\.blockedReason/);
    expect(checkoutPlaceOrderCtaSrc).toMatch(/primaryLabel: "Place order"/);
    expect(checkoutPaymentSrc).not.toMatch(/MobileBottomActionBar/);
  });

  it("post-payment replay no-ops when order is already paid", () => {
    expect(postPaymentSrc).toMatch(/status !== "pending_payment"/);
    expect(postPaymentSrc).toMatch(/await clearCheckoutSourceCartForOrder\(orderId\)/);
    expect(postPaymentSrc).toMatch(/return;/);
  });

  it("Issues workbench only removes retry item when API ok is true", () => {
    expect(issuesWorkbenchSrc).toMatch(/data\.ok === true/);
  });
});
