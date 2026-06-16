import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));

describe("checkout guided mobile layout", () => {
  const pageSrc = readFileSync(join(dir, "page.tsx"), "utf8");
  const formSrc = readFileSync(join(dir, "CheckoutForm.tsx"), "utf8");
  const paymentSrc = readFileSync(join(dir, "CheckoutPaymentStep.tsx"), "utf8");
  const summarySrc = readFileSync(join(dir, "CheckoutOrderSummary.tsx"), "utf8");

  it("renders checkout header helper and order summary component", () => {
    expect(pageSrc).toMatch(/Review your order, add payment, and place your pickup order/);
    expect(pageSrc).toMatch(/CheckoutOrderSummary/);
    expect(pageSrc).toMatch(/mobileBottomActionBarContentPadClass/);
  });

  it("uses guided section cards in checkout form", () => {
    expect(formSrc).toMatch(/CheckoutSectionCard/);
    expect(formSrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.contact/);
    expect(formSrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.review/);
    expect(formSrc).toMatch(/resolveCheckoutFormCtaState/);
  });

  it("uses sticky place-order bar with total summary on payment step", () => {
    expect(paymentSrc).toMatch(/MobileBottomActionBar/);
    expect(paymentSrc).toMatch(/resolveCheckoutPaymentCtaState/);
    expect(paymentSrc).toMatch(/primaryLabel=\{paymentCta\.primaryLabel\}/);
    expect(paymentSrc).toMatch(/summaryTitle=\{paymentCta\.summaryTitle\}/);
  });

  it("supports collapsible order summary on mobile", () => {
    expect(summarySrc).toMatch(/aria-expanded=\{mobileExpanded\}/);
    expect(summarySrc).toMatch(/CHECKOUT_SECTION_HEADINGS\.orderSummary/);
    expect(summarySrc).toMatch(/formatMobileBottomActionSummary/);
  });
});
