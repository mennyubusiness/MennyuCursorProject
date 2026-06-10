import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPostEndCartClientSnapshot,
  dispatchGroupOrderEndCartSnapshot,
} from "./group-order-end-sync";
import { shouldApplyCartSnapshot, shouldQuickCartApplyCartSnapshot } from "./cart-client-sync";
import type { Cart } from "@/domain/types";

const endedGroupCart: Cart = {
  id: "cart_go",
  podId: "pod_a",
  sessionId: "sess_1",
  podName: "Pod A",
  items: [{ id: "line_1", quantity: 2 } as Cart["items"][number]],
  groups: [],
  subtotalCents: 1200,
  groupOrder: {
    role: "host",
    canCheckout: true,
    joinCode: "123456",
    groupOrderSessionId: "gos_1",
  },
  cartScope: "group_order",
};

describe("group-order-end-sync", () => {
  it("buildPostEndCartClientSnapshot clears group items and controls", () => {
    const cleared = buildPostEndCartClientSnapshot(endedGroupCart);
    expect(cleared).toMatchObject({
      id: "cart_go",
      podId: "pod_a",
      items: [],
      groups: [],
      subtotalCents: 0,
    });
    expect(cleared?.groupOrder).toBeUndefined();
    expect(cleared).not.toHaveProperty("joinToken");
  });

  it("group-order-ended snapshot applies even when cartId unchanged", () => {
    const cleared = buildPostEndCartClientSnapshot(endedGroupCart);
    expect(
      shouldApplyCartSnapshot(
        { cart: cleared, source: "group-order-ended" },
        "vendor-menu",
        { cartId: "cart_go", podId: "pod_a" }
      )
    ).toBe(true);
    expect(
      shouldQuickCartApplyCartSnapshot(
        { cart: null, source: "group-order-ended" },
        endedGroupCart,
        "pod_a"
      )
    ).toBe(true);
  });
});

describe("group order end wiring", () => {
  const actionsSrc = readFileSync(
    join(process.cwd(), "src/actions/group-order.actions.ts"),
    "utf8"
  );
  const quickCartSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );
  const panelSrc = readFileSync(
    join(process.cwd(), "src/app/cart/GroupOrderCartPanel.tsx"),
    "utf8"
  );
  const cartPageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const recoverySrc = readFileSync(
    join(process.cwd(), "src/lib/cart-mutation-access-recovery.ts"),
    "utf8"
  );
  const serviceSrc = readFileSync(
    join(process.cwd(), "src/services/group-order.service.ts"),
    "utf8"
  );

  it("end action returns post-end cart snapshot", () => {
    expect(actionsSrc).toContain("buildPostEndCartClientSnapshot");
    expect(actionsSrc).toContain("groupEnded: true");
    expect(actionsSrc).toContain("endedSessionId");
  });

  it("dispatches group-order-ended client event", () => {
    const endBtnSrc = readFileSync(
      join(process.cwd(), "src/components/cart/EndGroupOrderHostButton.tsx"),
      "utf8"
    );
    expect(dispatchGroupOrderEndCartSnapshot).toBeDefined();
    expect(panelSrc).toContain("EndGroupOrderHostButton");
    expect(endBtnSrc).toContain("dispatchGroupOrderEndCartSnapshot");
    expect(cartPageSrc).toContain("GroupOrderEndCartSync");
    expect(cartPageSrc).toContain("groupEnded");
  });

  it("Quick Cart listens for group-order-ended", () => {
    expect(quickCartSrc).toContain('detail.source === "group-order-ended"');
  });

  it("host can recover solo add after ended group on same cart row", () => {
    expect(recoverySrc).toMatch(/requestedGroup\.status === "ended"/);
    expect(serviceSrc).toMatch(/gos\.status === "ended"/);
  });

  it("ended host group state is inactive on cart page", () => {
    const cartPageStateSrc = readFileSync(
      join(process.cwd(), "src/lib/group-order-cart-page.ts"),
      "utf8"
    );
    expect(cartPageStateSrc).toMatch(/status === "ended"/);
    expect(cartPageStateSrc).toMatch(/active: false/);
  });
});
