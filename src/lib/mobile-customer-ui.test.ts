import { describe, expect, it } from "vitest";
import {
  formatMobileBottomActionSummary,
  isCustomerOrderingPath,
  MOBILE_MIN_TAP_TARGET_CLASS,
  MOBILE_PRIMARY_CTA_MIN_HEIGHT_CLASS,
} from "@/lib/mobile-customer-ui";
import {
  mobileBottomActionBarContentPadClass,
  mobileBottomActionBarFixedClass,
  mobileSafeAreaBottomPadding,
} from "@/lib/mobile-sticky-cart-bar-classes";

describe("mobile-customer-ui helpers", () => {
  it("formats cart summary labels for sticky bars", () => {
    expect(formatMobileBottomActionSummary(1, 1299)).toBe("1 item · $12.99");
    expect(formatMobileBottomActionSummary(3, 4550)).toBe("3 items · $45.50");
  });

  it("detects customer ordering paths for minimal mobile nav", () => {
    expect(isCustomerOrderingPath("/pod/abc")).toBe(true);
    expect(isCustomerOrderingPath("/pod/abc/vendor/v1")).toBe(true);
    expect(isCustomerOrderingPath("/cart")).toBe(true);
    expect(isCustomerOrderingPath("/checkout")).toBe(true);
    expect(isCustomerOrderingPath("/order/ord_123")).toBe(true);
    expect(isCustomerOrderingPath("/")).toBe(false);
    expect(isCustomerOrderingPath("/explore")).toBe(false);
  });

  it("exports touch-friendly utility classes", () => {
    expect(MOBILE_MIN_TAP_TARGET_CLASS).toBe("min-h-11");
    expect(MOBILE_PRIMARY_CTA_MIN_HEIGHT_CLASS).toBe("min-h-[3.25rem]");
  });
});

describe("mobile sticky bar classes", () => {
  it("includes safe-area padding on fixed bottom bars", () => {
    expect(mobileBottomActionBarFixedClass).toContain(mobileSafeAreaBottomPadding);
    expect(mobileBottomActionBarContentPadClass).toContain("safe-area-inset-bottom");
  });
});
