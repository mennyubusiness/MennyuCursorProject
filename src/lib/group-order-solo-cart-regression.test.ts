import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isTerminalGroupOrderSessionStatus,
  shouldTreatUnknownViewerAsSoloForTerminalGroup,
} from "@/lib/group-order-session-status";

describe("group-order-session-status", () => {
  it("identifies terminal session statuses", () => {
    expect(isTerminalGroupOrderSessionStatus("ended")).toBe(true);
    expect(isTerminalGroupOrderSessionStatus("expired")).toBe(true);
    expect(isTerminalGroupOrderSessionStatus("submitted")).toBe(true);
    expect(isTerminalGroupOrderSessionStatus("active")).toBe(false);
    expect(isTerminalGroupOrderSessionStatus("locked_checkout")).toBe(false);
  });

  it("treats unknown viewers on terminal sessions as solo-safe", () => {
    expect(shouldTreatUnknownViewerAsSoloForTerminalGroup("ended", "unknown")).toBe(true);
    expect(shouldTreatUnknownViewerAsSoloForTerminalGroup("active", "unknown")).toBe(false);
    expect(shouldTreatUnknownViewerAsSoloForTerminalGroup("ended", "participant")).toBe(false);
    expect(shouldTreatUnknownViewerAsSoloForTerminalGroup("ended", "host")).toBe(false);
  });
});

describe("solo cart stale group metadata regression", () => {
  it("GroupOrderCartPanel hides ended messaging for unknown viewers", () => {
    const panelSrc = readFileSync(
      join(process.cwd(), "src/app/cart/GroupOrderCartPanel.tsx"),
      "utf8"
    );
    expect(panelSrc).toMatch(/if \(isEnded\) \{\s*\n\s*if \(isUnknown\) return null;/);
    expect(panelSrc).toMatch(/The host ended this group order before checkout/);
  });

  it("getGroupOrderStateForCartPage deactivates unknown viewers on terminal sessions", () => {
    const cartPageStateSrc = readFileSync(
      join(process.cwd(), "src/lib/group-order-cart-page.ts"),
      "utf8"
    );
    expect(cartPageStateSrc).toMatch(/isTerminalGroupOrderSessionStatus\(s\.status\)/);
    expect(cartPageStateSrc).toMatch(/return \{ active: false \}/);
  });

  it("buildGroupOrderViewerContext treats ended sessions as solo", () => {
    const viewerCtxSrc = readFileSync(
      join(process.cwd(), "src/lib/group-order-viewer-context.ts"),
      "utf8"
    );
    expect(viewerCtxSrc).toMatch(/session\.status === "ended"/);
    expect(viewerCtxSrc).toMatch(/return SOLO_VIEWER/);
  });
});
