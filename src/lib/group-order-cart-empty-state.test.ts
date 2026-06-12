import { describe, expect, it } from "vitest";
import {
  resolveGroupCartEmptyState,
  shouldShowJoinGroupOrderForm,
} from "./group-order-cart-empty-state";

describe("group-order-cart-empty-state", () => {
  it("host with zero items → host_group_empty", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: true,
        goView: "host",
      })
    ).toBe("host_group_empty");
  });

  it("participant with zero own items → participant_group_empty", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: true,
        goView: "participant",
      })
    ).toBe("participant_group_empty");
  });

  it("solo empty cart without group session", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 0,
        goStateActive: false,
        goView: null,
      })
    ).toBe("solo_empty");
  });

  it("hides join form when group session active", () => {
    expect(shouldShowJoinGroupOrderForm({ goStateActive: true })).toBe(false);
    expect(shouldShowJoinGroupOrderForm({ goStateActive: false })).toBe(true);
  });

  it("group cart with items → has_items", () => {
    expect(
      resolveGroupCartEmptyState({
        displayItemCount: 2,
        goStateActive: true,
        goView: "host",
      })
    ).toBe("has_items");
  });
});

describe("cart page wiring", () => {
  it("uses host group empty state and hides join form for active group", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const cartPage = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
    expect(cartPage).toMatch(/host_group_empty/);
    expect(cartPage).toMatch(/GroupOrderHostEmptyCartCard/);
    expect(cartPage).toMatch(/shouldShowJoinGroupOrderForm/);
    const panel = readFileSync(join(process.cwd(), "src/app/cart/GroupOrderCartPanel.tsx"), "utf8");
    expect(panel).toMatch(/GroupOrderInviteShareControls/);
    expect(panel).toMatch(/buildGroupOrderJoinAbsoluteUrl/);
  });

  it("Quick Cart uses host invite controls", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const groupSrc = readFileSync(
      join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
      "utf8"
    );
    const hostControls = readFileSync(
      join(process.cwd(), "src/components/cart/QuickCartHostGroupControls.tsx"),
      "utf8"
    );
    expect(groupSrc).toMatch(/QuickCartHostGroupControls/);
    expect(hostControls).toMatch(/Copy code/);
    expect(hostControls).toMatch(/Invite options/);
    expect(hostControls).toMatch(/GroupOrderInviteQrModal/);
    expect(hostControls).not.toMatch(/group-order\/join\?session=/);
    expect(hostControls).not.toMatch(/Add items/);
    expect(hostControls).not.toMatch(/\/cart#group-order-invite/);
  });
});
