import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Z_HEADER,
  Z_MOBILE_BOTTOM_ACTION_BAR,
  Z_MOBILE_MENU_BACKDROP,
  Z_MOBILE_MENU_PANEL,
  Z_MOBILE_MENU_TOGGLE,
  Z_POD_STICKY,
  Z_QUICK_CART_DRAWER,
} from "./layout-z-index";

describe("layout z-index scale", () => {
  it("keeps mobile menu above page chrome and below Quick Cart drawer", () => {
    expect(Z_POD_STICKY).toBeLessThan(Z_MOBILE_BOTTOM_ACTION_BAR);
    expect(Z_MOBILE_BOTTOM_ACTION_BAR).toBeLessThan(Z_HEADER);
    expect(Z_HEADER).toBeLessThan(Z_MOBILE_MENU_BACKDROP);
    expect(Z_MOBILE_MENU_BACKDROP).toBeLessThan(Z_MOBILE_MENU_PANEL);
    expect(Z_MOBILE_MENU_PANEL).toBeLessThan(Z_MOBILE_MENU_TOGGLE);
    expect(Z_MOBILE_MENU_TOGGLE).toBeLessThan(Z_QUICK_CART_DRAWER);
  });

  it("pod sticky nav uses page-level z-index below mobile menu", () => {
    const stickyNavSrc = readFileSync(
      join(process.cwd(), "src/components/pod/PodPageStickyNav.tsx"),
      "utf8"
    );
    const barClassesSrc = readFileSync(
      join(process.cwd(), "src/lib/mobile-sticky-cart-bar-classes.ts"),
      "utf8"
    );
    expect(stickyNavSrc).toMatch(/z-30/);
    expect(stickyNavSrc).not.toMatch(/z-40/);
    expect(barClassesSrc).toMatch(/z-40/);
  });
});
