import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyGroupOrderVisibilityToCart,
  filterCartLinesForViewer,
  isGroupCartLineVisibleToViewer,
  type GroupOrderViewerContext,
} from "./group-order-viewer-context";
import type { Cart } from "@/domain/types";

const hostCtx: GroupOrderViewerContext = {
  isGroupOrder: true,
  groupOrderSessionId: "gos_1",
  viewerRole: "host",
  viewerParticipantId: "p_host",
  hostParticipantId: "p_host",
  hostUserId: "user_1",
  canViewAllLines: true,
  canEditAllLines: true,
  canCheckout: true,
  joinCode: "123456",
};

const participantCtx: GroupOrderViewerContext = {
  isGroupOrder: true,
  groupOrderSessionId: "gos_1",
  viewerRole: "participant",
  viewerParticipantId: "p_alex",
  hostParticipantId: "p_host",
  hostUserId: "user_1",
  canViewAllLines: false,
  canEditAllLines: false,
  canCheckout: false,
  joinCode: null,
};

describe("group-order-viewer-context", () => {
  it("host sees all lines", () => {
    const lines = [
      { id: "1", groupOrderParticipantId: "p_host" },
      { id: "2", groupOrderParticipantId: "p_alex" },
    ];
    expect(filterCartLinesForViewer(lines, hostCtx)).toHaveLength(2);
  });

  it("participant sees only own lines", () => {
    const lines = [
      { id: "1", groupOrderParticipantId: "p_host" },
      { id: "2", groupOrderParticipantId: "p_alex" },
      { id: "3", groupOrderParticipantId: "p_alex" },
    ];
    const filtered = filterCartLinesForViewer(lines, participantCtx);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((l) => l.groupOrderParticipantId === "p_alex")).toBe(true);
  });

  it("participant does not see host-attributed lines", () => {
    expect(isGroupCartLineVisibleToViewer("p_host", participantCtx)).toBe(false);
    expect(isGroupCartLineVisibleToViewer(null, participantCtx)).toBe(false);
  });

  it("applyGroupOrderVisibilityToCart strips other items from Cart JSON", () => {
    const cart: Cart = {
      id: "cart_1",
      podId: "pod_1",
      sessionId: "sess_1",
      subtotalCents: 5000,
      items: [
        {
          id: "li_host",
          menuItemId: "m1",
          vendorId: "v1",
          quantity: 1,
          priceCents: 2000,
          specialInstructions: null,
        },
        {
          id: "li_alex",
          menuItemId: "m2",
          vendorId: "v1",
          quantity: 1,
          priceCents: 3000,
          specialInstructions: null,
        },
      ],
      groups: [
        {
          vendorId: "v1",
          vendorName: "Vendor",
          subtotalCents: 5000,
          items: [],
        },
      ],
    };
    const map = new Map<string, string | null>([
      ["li_host", "p_host"],
      ["li_alex", "p_alex"],
    ]);
    const scoped = applyGroupOrderVisibilityToCart(cart, participantCtx, map);
    expect(scoped.items).toHaveLength(1);
    expect(scoped.items[0]?.id).toBe("li_alex");
    expect(scoped.subtotalCents).toBe(3000);
  });
});

describe("cart page render path", () => {
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");

  it("filters display cart lines server-side for group viewers", () => {
    expect(cartPageSrc).toMatch(/filterCartLinesForViewer/);
    expect(cartPageSrc).toMatch(/buildGroupOrderViewerContext/);
  });

  it("does not expose participant join token secret in cart page", () => {
    const withoutCookieParamName = cartPageSrc.replace(/joinTokenFromCookie/g, "");
    expect(withoutCookieParamName).not.toMatch(/joinToken/);
  });
});
