import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Quick Cart open state", () => {
  const contextSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );

  it("does not auto-close after GET /api/cart returns an empty payload", () => {
    const applyPayloadBlock = contextSrc.slice(
      contextSrc.indexOf("const applyPayload = useCallback"),
      contextSrc.indexOf("const applyCartSnapshot = useCallback")
    );
    expect(applyPayloadBlock).not.toMatch(/setIsOpen\(false\)/);
  });

  it("still closes on intentional clear snapshot and clear actions", () => {
    expect(contextSrc).toMatch(/applyCartSnapshot[\s\S]*?if \(!displayCart\)[\s\S]*?setIsOpen\(false\)/);
    expect(contextSrc).toMatch(/clearActiveSoloCart[\s\S]*setIsOpen\(false\)/);
    expect(contextSrc).toMatch(/clearAndSwitchSoloCart[\s\S]*setIsOpen\(false\)/);
  });

  it("drawer renders empty states while open instead of unmounting", () => {
    expect(drawerSrc).not.toMatch(
      /!hasItems && !hasActiveGroupOrder && !hasDisplayableRecovery && !loading/
    );
    expect(drawerSrc).toContain("showNeutralEmpty");
    expect(drawerSrc).toContain("showBrowsingEmpty");
    expect(drawerSrc).toContain('onClick={closeCart}');
  });

  it("Escape closes Quick Cart via context listener", () => {
    expect(contextSrc).toMatch(/if \(e\.key === "Escape"\) closeCart\(\)/);
  });

  it("openCart sets isOpen before refreshCart", () => {
    const openCartBlock = contextSrc.slice(
      contextSrc.indexOf("const openCart = useCallback"),
      contextSrc.indexOf("const closeCart = useCallback")
    );
    expect(openCartBlock).toMatch(/setIsOpen\(true\)/);
    expect(openCartBlock).toMatch(/refreshCart\(\)/);
  });
});
