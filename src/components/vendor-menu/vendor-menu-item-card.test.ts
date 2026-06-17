import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("VendorMenuItemCard tappable surface", () => {
  const cardSrc = readFileSync(
    join(root, "components/vendor-menu/VendorMenuItemCard.tsx"),
    "utf8"
  );
  const addButtonSrc = readFileSync(
    join(root, "app/pod/[podId]/vendor/[vendorId]/AddToCartButton.tsx"),
    "utf8"
  );

  it("renders card body as an accessible button separate from overlay controls", () => {
    expect(cardSrc).toMatch(/role=\{itemUnavailable \? undefined : "button"\}/);
    expect(cardSrc).toMatch(/handleMenuItemCardKeyDown/);
    expect(cardSrc).toMatch(/addAction=\{addAction\}/);
    expect(cardSrc).toMatch(/pointer-events-auto/);
  });

  it("stops overlay clicks from bubbling to the card surface", () => {
    expect(addButtonSrc).toMatch(/stopOverlayBubble/);
    expect(addButtonSrc).toMatch(/addActionProp/);
  });
});

describe("Cart page mobile checkout bar", () => {
  const actionsSrc = readFileSync(join(root, "app/cart/cart-page-checkout-actions.tsx"), "utf8");
  const pageSrc = readFileSync(join(root, "app/cart/page.tsx"), "utf8");

  it("uses MobileBottomActionBar for mobile checkout", () => {
    expect(actionsSrc).toMatch(/MobileBottomActionBar/);
    expect(actionsSrc).toMatch(/resolveCartCheckoutCtaState/);
    expect(actionsSrc).toMatch(/Proceed to checkout/);
  });

  it("applies bottom padding and mobile checkout surface on cart page", () => {
    expect(pageSrc).toMatch(/mobileBottomActionBarContentPadClass/);
    expect(pageSrc).toMatch(/surface="mobile"/);
  });

  it("renders polished empty cart primary action", () => {
    expect(pageSrc).toMatch(/oo-empty-state/);
    expect(pageSrc).toMatch(/Browse pods/);
  });
});
