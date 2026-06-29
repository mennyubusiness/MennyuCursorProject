import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Quick Cart clear-state wiring", () => {
  const contextSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );
  const syncSrc = readFileSync(join(process.cwd(), "src/lib/cart-client-sync.ts"), "utf8");

  it("closes Quick Cart only on explicit null snapshot and clear actions", () => {
    const applyCartSnapshotBlock = contextSrc.slice(
      contextSrc.indexOf("const applyCartSnapshot = useCallback"),
      contextSrc.indexOf("const refreshCart = useCallback")
    );
    expect(contextSrc).toContain("applyCartSnapshot(null)");
    expect(contextSrc).toContain("resolveQuickCartSnapshotAfterUpdate");
    expect(applyCartSnapshotBlock).toMatch(/if \(next === null\)[\s\S]*?setIsOpen\(false\)/);
    expect(applyCartSnapshotBlock).not.toMatch(/if \(!displayCart\)[\s\S]*?setIsOpen\(false\)/);
  });

  it("does not auto-close drawer when API refresh returns empty", () => {
    const applyPayloadBlock = contextSrc.slice(
      contextSrc.indexOf("const applyPayload = useCallback"),
      contextSrc.indexOf("const applyCartSnapshot = useCallback")
    );
    expect(applyPayloadBlock).not.toMatch(/setIsOpen\(false\)/);
  });

  it("closes drawer after clearActiveSoloCart succeeds", () => {
    expect(contextSrc).toMatch(/clearActiveSoloCart[\s\S]*setIsOpen\(false\)/);
    expect(contextSrc).toMatch(/clearAndSwitchSoloCart[\s\S]*setIsOpen\(false\)/);
  });

  it("renders empty Quick Cart states while open", () => {
    expect(drawerSrc).toContain("showNeutralEmpty");
    expect(drawerSrc).not.toMatch(
      /!hasItems && !hasActiveGroupOrder && !hasDisplayableRecovery && !loading/
    );
  });

  it("itemCount uses empty cart rows instead of recovery fallback", () => {
    expect(contextSrc).toMatch(
      /if \(cart\) \{\s*\n\s*return cart\.items\.reduce/
    );
  });
});
