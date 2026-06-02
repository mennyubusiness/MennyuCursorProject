import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const checkoutPageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
const cartMutationSrc = readFileSync(join(dir, "../cart/CartPageMutationSync.tsx"), "utf8");
const checkoutFormSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
const checkoutPaymentSrc = readFileSync(join(dir, "CheckoutPaymentStep.tsx"), "utf8");
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
  it("blocks continue while revalidation is pending", () => {
    expect(cartMutationSrc).toMatch(/checkoutEnabled = canCheckout && !isRevalidating/);
  });

  it("marks cart invalid when revalidation fails", () => {
    expect(cartMutationSrc).toMatch(/REVALIDATION_FAILED/);
  });
});

describe("checkout payment lifecycle guards", () => {
  it("reuses existing pending_payment order for same cart", () => {
    expect(orderServiceSrc).toMatch(/sourceCartId: input\.cartId, status: "pending_payment"/);
  });

  it("inline Stripe success navigates with payment=success for reconcile", () => {
    expect(checkoutFormSrc).toMatch(/payment:\s*"success"/);
  });

  it("does not clear cart client-side before payment confirms", () => {
    expect(checkoutPaymentSrc).not.toMatch(/clearCartOnServerAndNotifyClient/);
  });

  it("post-payment replay no-ops when order is already paid", () => {
    expect(postPaymentSrc).toMatch(/status !== "pending_payment"/);
    expect(postPaymentSrc).toMatch(/await clearCheckoutSourceCartForOrder\(orderId\)/);
    expect(postPaymentSrc).toMatch(/return;/);
  });

  it("Issues workbench only removes retry item when API ok is true", () => {
    expect(issuesWorkbenchSrc).toMatch(/data\.ok !== false/);
  });
});
