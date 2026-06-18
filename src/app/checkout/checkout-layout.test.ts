import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

describe("checkout guided layout", () => {
  const pageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
  const formSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
  const paymentSrc = readFileSync(join(dir, "CheckoutPaymentStep.tsx"), "utf8");
  const summarySrc = readFileSync(join(dir, "CheckoutOrderSummary.tsx"), "utf8");

  it("renders checkout header helper and order summary component", () => {
    expect(pageSrc).toMatch(/Review your order, add payment, and place your pickup order/);
    expect(pageSrc).toMatch(/CheckoutOrderSummary/);
    expect(pageSrc).not.toMatch(/mobileBottomActionBarContentPadClass/);
  });

  it("uses guided section cards with in-page continue action", () => {
    expect(formSrc).toMatch(/CheckoutSectionCard/);
    expect(formSrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.contact/);
    expect(formSrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.review/);
    expect(formSrc).toMatch(/resolveCheckoutFormCtaState/);
    expect(formSrc).toMatch(/formCta\.primaryLabel/);
    expect(formSrc).toMatch(/inline-flex w-full items-center justify-center/);
    expect(formSrc).not.toMatch(/MobileBottomActionBar/);
    expect(formSrc).not.toMatch(/hidden w-full sm:inline-flex/);
  });

  it("uses in-page place-order action on payment step", () => {
    expect(paymentSrc).toMatch(/resolveCheckoutPaymentCtaState/);
    expect(paymentSrc).toMatch(/\{paymentCta\.primaryLabel\}/);
    expect(paymentSrc).toMatch(/inline-flex w-full items-center justify-center/);
    expect(paymentSrc).not.toMatch(/MobileBottomActionBar/);
    expect(paymentSrc).not.toMatch(/MobileCustomerPageShell/);
    expect(paymentSrc).not.toMatch(/hidden w-full sm:inline-flex/);
  });

  it("shows blocked reason when payment CTA is disabled", () => {
    expect(paymentSrc).toMatch(/paymentCta\.blockedReason/);
    expect(formSrc).toMatch(/formCta\.blockedReason/);
  });

  it("supports collapsible order summary on mobile", () => {
    expect(summarySrc).toMatch(/aria-expanded=\{mobileExpanded\}/);
    expect(summarySrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.orderSummary/);
    expect(summarySrc).toMatch(/formatMobileBottomActionSummary/);
  });
});
