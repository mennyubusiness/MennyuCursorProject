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

  it("clears Quick Cart snapshot to null after cart clear events", () => {
    expect(contextSrc).toContain("applyCartSnapshot(null)");
    expect(contextSrc).toContain("resolveQuickCartSnapshotAfterUpdate");
    expect(contextSrc).toContain("setIsOpen(false)");
  });

  it("closes drawer after clearActiveSoloCart succeeds", () => {
    expect(contextSrc).toMatch(/clearActiveSoloCart[\s\S]*setIsOpen\(false\)/);
    expect(contextSrc).toMatch(/clearAndSwitchSoloCart[\s\S]*setIsOpen\(false\)/);
  });

  it("does not render residual empty Quick Cart shell", () => {
    expect(drawerSrc).toContain("isActiveCartRecoveryDisplayable");
    expect(drawerSrc).toMatch(/!hasItems && !hasActiveGroupOrder && !hasDisplayableRecovery/);
  });

  it("broadcasts null cart snapshot on clear", () => {
    expect(syncSrc).toMatch(/dispatchCartUpdated\(\{\s*cart: null,/);
  });
});
