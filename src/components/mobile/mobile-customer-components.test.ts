import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("MobileBottomActionBar", () => {
  const src = readFileSync(join(root, "components/mobile/MobileBottomActionBar.tsx"), "utf8");

  it("uses touch-sized primary buttons and safe-area bar shell", () => {
    expect(src).toMatch(/size: "touch"/);
    expect(src).toMatch(/mobileBottomActionBarFixedClass/);
    expect(src).toMatch(/summaryTitle/);
    expect(src).toMatch(/primaryHref/);
  });
});

describe("MobileBottomSheet", () => {
  const src = readFileSync(join(root, "components/mobile/MobileBottomSheet.tsx"), "utf8");

  it("renders as mobile-first bottom sheet with large close control", () => {
    expect(src).toMatch(/items-end/);
    expect(src).toMatch(/rounded-t-3xl/);
    expect(src).toMatch(/h-11 w-11/);
    expect(src).toMatch(/Z_BOTTOM_SHEET/);
  });
});

describe("JoinGroupOrderByCodeModal", () => {
  const src = readFileSync(join(root, "components/group-order/JoinGroupOrderByCodeModal.tsx"), "utf8");

  it("uses shared MobileBottomSheet instead of bespoke portal markup", () => {
    expect(src).toMatch(/MobileBottomSheet/);
    expect(src).not.toMatch(/createPortal/);
  });
});

describe("ModifierModal mobile sheet", () => {
  const src = readFileSync(join(root, "app/pod/[podId]/vendor/[vendorId]/ModifierModal.tsx"), "utf8");

  it("uses bottom sheet with sticky add-to-cart action bar", () => {
    expect(src).toMatch(/MobileBottomSheet/);
    expect(src).toMatch(/MobileBottomActionBar/);
    expect(src).toMatch(/Add to cart/);
  });
});

describe("SiteHeaderNav mobile ordering chrome", () => {
  const src = readFileSync(join(root, "components/SiteHeaderNav.tsx"), "utf8");

  it("shows compact cart access on mobile and hides business CTA in ordering flow", () => {
    expect(src).toMatch(/headerCompact/);
    expect(src).toMatch(/isCustomerOrderingPath/);
    expect(src).toMatch(/showMobileBusinessCta/);
  });
});
