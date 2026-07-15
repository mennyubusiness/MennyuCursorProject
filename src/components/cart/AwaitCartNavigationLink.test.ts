import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("AwaitCartNavigationLink View Cart loading", () => {
  const src = readFileSync(
    join(root, "src/components/cart/AwaitCartNavigationLink.tsx"),
    "utf8"
  );

  it("shows Opening cart… loading state and disables repeat presses", () => {
    expect(src).toMatch(/Opening cart…/);
    expect(src).toMatch(/navigating/);
    expect(src).toMatch(/if \(navigating\) return/);
    expect(src).toMatch(/animate-spin/);
  });

  it("flushes cart work before navigation and restores on failure", () => {
    expect(src).toMatch(/flushAllCartWork/);
    expect(src).toMatch(/router\.push/);
    expect(src).toMatch(/setNavigating\(false\)/);
    expect(src).toMatch(/router\.prefetch/);
  });

  it("defers drawer close until navigation is requested", () => {
    const drawer = readFileSync(
      join(root, "src/components/cart/QuickCartDrawer.tsx"),
      "utf8"
    );
    const linkBlock = drawer.slice(
      drawer.indexOf("<AwaitCartNavigationLink"),
      drawer.indexOf("</AwaitCartNavigationLink>")
    );
    expect(linkBlock).toMatch(/onNavigating=\{closeCart\}/);
    expect(linkBlock).not.toMatch(/onClick=\{closeCart\}/);
  });
});
