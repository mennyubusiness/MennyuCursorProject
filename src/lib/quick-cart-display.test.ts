import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachQuickCartDisplay,
  quickCartFooterCtaLabel,
  quickCartPodLinkLabel,
  quickCartSubtitle,
  resolveQuickCartPodContext,
} from "./quick-cart-display";
import type { Cart } from "@/domain/types";
import type { GroupOrderViewerContext } from "./group-order-viewer-context";

const soloCtx: GroupOrderViewerContext = {
  isGroupOrder: false,
  groupOrderSessionId: null,
  viewerRole: "solo",
  viewerParticipantId: null,
  hostParticipantId: null,
  hostUserId: null,
  canViewAllLines: true,
  canEditAllLines: true,
  canCheckout: true,
  joinCode: null,
};

const baseCart: Cart = {
  id: "cart_1",
  podId: "pod_a",
  sessionId: "sess_1",
  items: [],
  groups: [],
  subtotalCents: 0,
};

describe("quick-cart-display", () => {
  it("attachQuickCartDisplay adds podName and solo groupOrder", () => {
    const out = attachQuickCartDisplay(baseCart, soloCtx, "Riverside Pod");
    expect(out.podName).toBe("Riverside Pod");
    expect(out.groupOrder?.role).toBe("solo");
    expect(out.groupOrder?.canCheckout).toBe(true);
    expect(out.groupOrder?.joinCode).toBeUndefined();
  });

  it("host attach includes joinCode and session id, never joinToken field", () => {
    const hostCtx: GroupOrderViewerContext = {
      ...soloCtx,
      isGroupOrder: true,
      groupOrderSessionId: "gos_1",
      viewerRole: "host",
      joinCode: "654321",
    };
    const out = attachQuickCartDisplay(baseCart, hostCtx, "Pod");
    expect(out.groupOrder?.joinCode).toBe("654321");
    expect(out.groupOrder?.groupOrderSessionId).toBe("gos_1");
    expect("joinToken" in (out.groupOrder ?? {})).toBe(false);
  });

  it("resolveQuickCartPodContext prefers cart pod over client", () => {
    expect(
      resolveQuickCartPodContext(
        { ...baseCart, podId: "pod_cart", podName: "Cart Pod" },
        "pod_client"
      )
    ).toEqual({ podId: "pod_cart", podName: "Cart Pod" });
    expect(resolveQuickCartPodContext(null, "pod_client")).toEqual({
      podId: "pod_client",
      podName: null,
    });
  });

  it("subtitle reflects group roles and pod", () => {
    expect(quickCartSubtitle({ podName: "Pod A", groupRole: "solo" })).toBe("For Pod A");
    expect(quickCartSubtitle({ podName: "Pod A", groupRole: "host" })).toBe("Group order · Pod A");
    expect(quickCartSubtitle({ podName: "Pod A", groupRole: "participant" })).toBe(
      "Your items · Pod A"
    );
    expect(quickCartSubtitle({ podName: null, groupRole: "solo" })).toBe(
      "Multi-vendor · one checkout"
    );
  });

  it("footer CTA labels differ for participant vs host vs solo checkout", () => {
    expect(
      quickCartFooterCtaLabel({ hasItems: true, groupRole: "participant", canCheckout: false })
    ).toBe("View my items");
    expect(
      quickCartFooterCtaLabel({ hasItems: false, groupRole: "participant", canCheckout: false })
    ).toBe("View group cart");
    expect(
      quickCartFooterCtaLabel({ hasItems: true, groupRole: "host", canCheckout: true })
    ).toBe("Go to group cart");
    expect(
      quickCartFooterCtaLabel({ hasItems: true, groupRole: "solo", canCheckout: true })
    ).toBe("Review cart & checkout");
  });

  it("pod link label uses pod name when known", () => {
    expect(quickCartPodLinkLabel("Riverside")).toBe("Back to Riverside");
    expect(quickCartPodLinkLabel(null)).toBe("Browse this pod");
  });
});

describe("QuickCartDrawer source", () => {
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );
  const groupSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
    "utf8"
  );

  it("does not render duplicate Open full cart page link", () => {
    expect(drawerSrc).not.toContain("Open full cart page");
  });

  it("shows group start/join actions and pod header helpers", () => {
    expect(groupSrc).toContain("Start group order");
    expect(groupSrc).toContain("Join with code");
    expect(drawerSrc).toContain("QuickCartHeader");
    expect(drawerSrc).toContain("QuickCartGroupSection");
  });

  it("does not expose joinToken in quick cart components", () => {
    expect(drawerSrc).not.toMatch(/joinToken/i);
    expect(groupSrc).not.toMatch(/joinToken/i);
  });
});
