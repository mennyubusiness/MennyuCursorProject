import { describe, expect, it } from "vitest";
import {
  buildActiveCartRecovery,
  isActiveCartRecoveryDisplayable,
  recoveryItemCountLabel,
  shouldShowActiveRecovery,
  shouldShowActiveRecoverySection,
  shouldSuppressNeutralGroupPromo,
} from "./quick-cart-active-recovery";
import type { Cart, QuickCartApiResponse } from "@/domain/types";

const soloCart: Cart = {
  id: "cart_1",
  podId: "pod_a",
  sessionId: "sess_1",
  podName: "Downtown",
  items: [
    {
      id: "l1",
      menuItemId: "m1",
      vendorId: "v1",
      quantity: 2,
      priceCents: 500,
      specialInstructions: null,
    },
  ],
  groups: [],
  subtotalCents: 1000,
  groupOrder: { role: "solo", canCheckout: true },
};

describe("buildActiveCartRecovery", () => {
  it("builds solo recovery with item count", () => {
    const r = buildActiveCartRecovery({
      cart: soloCart,
      browsePodId: null,
      browsePodName: null,
    });
    expect(r.kind).toBe("solo_cart");
    expect(r.podName).toBe("Downtown");
    expect(r.itemCount).toBe(2);
    expect(r.isConflictingWithBrowsePod).toBe(false);
    expect("joinToken" in r).toBe(false);
  });

  it("flags browse conflict when pods differ", () => {
    const r = buildActiveCartRecovery({
      cart: soloCart,
      browsePodId: "pod_b",
      browsePodName: "Uptown",
    });
    expect(r.isConflictingWithBrowsePod).toBe(true);
    expect(r.isCurrentContext).toBe(false);
  });

  it("host recovery includes group code but not joinToken", () => {
    const r = buildActiveCartRecovery({
      cart: {
        ...soloCart,
        groupOrder: {
          role: "host",
          canCheckout: true,
          joinCode: "123456",
          groupOrderSessionId: "gos_1",
        },
      },
      browsePodId: null,
      browsePodName: null,
      participantCount: 3,
    });
    expect(r.kind).toBe("group_host");
    expect(r.groupCode).toBe("123456");
    expect(r.participantCount).toBe(3);
    expect("joinToken" in r).toBe(false);
  });

  it("participant recovery has no group code", () => {
    const r = buildActiveCartRecovery({
      cart: {
        ...soloCart,
        groupOrder: { role: "participant", canCheckout: false },
      },
      browsePodId: null,
      browsePodName: null,
    });
    expect(r.kind).toBe("group_participant");
    expect(r.groupCode).toBeUndefined();
  });
});

describe("isActiveCartRecoveryDisplayable", () => {
  it("hides solo recovery after clear when item count is zero", () => {
    const cleared = buildActiveCartRecovery({
      cart: { ...soloCart, items: [], subtotalCents: 0 },
      browsePodId: null,
      browsePodName: null,
    });
    expect(cleared.itemCount).toBe(0);
    expect(isActiveCartRecoveryDisplayable(cleared)).toBe(false);
  });

  it("keeps group host recovery visible with zero items", () => {
    const groupRecovery = buildActiveCartRecovery({
      cart: {
        ...soloCart,
        items: [],
        subtotalCents: 0,
        groupOrder: {
          role: "host",
          canCheckout: true,
          joinCode: "280963",
          groupOrderSessionId: "gos_1",
        },
      },
      browsePodId: null,
      browsePodName: null,
    });
    expect(isActiveCartRecoveryDisplayable(groupRecovery)).toBe(true);
  });
});

describe("shouldShowActiveRecoverySection", () => {
  const base: QuickCartApiResponse = {
    scope: "neutral",
    cart: null,
    browsingPodId: null,
    browsingPodName: null,
    assignedPodId: "pod_a",
    assignedPodName: "Downtown",
    requiresClearToSwitchPod: false,
    activeCartRecovery: buildActiveCartRecovery({
      cart: soloCart,
      browsePodId: null,
      browsePodName: null,
    }),
  };

  it("shows on neutral with solo active recovery", () => {
    expect(shouldShowActiveRecoverySection(base)).toBe(true);
  });

  it("hides zero-item solo recovery on neutral scope", () => {
    expect(
      shouldShowActiveRecoverySection({
        ...base,
        activeCartRecovery: buildActiveCartRecovery({
          cart: { ...soloCart, items: [], subtotalCents: 0 },
          browsePodId: null,
          browsePodName: null,
        }),
      })
    ).toBe(false);
  });

  it("hides group host recovery on neutral when drawer shows group cart", () => {
    const groupRecovery = buildActiveCartRecovery({
      cart: {
        ...soloCart,
        items: [],
        subtotalCents: 0,
        groupOrder: {
          role: "host",
          canCheckout: true,
          joinCode: "280963",
          groupOrderSessionId: "gos_1",
        },
      },
      browsePodId: null,
      browsePodName: null,
    });
    expect(
      shouldShowActiveRecoverySection({
        ...base,
        scope: "group_order",
        cart: soloCart,
        activeCartRecovery: groupRecovery,
      })
    ).toBe(false);
  });

  it("shows on browse conflict", () => {
    expect(
      shouldShowActiveRecoverySection({
        ...base,
        scope: "browsing_pod",
        requiresClearToSwitchPod: true,
        browsingPodId: "pod_b",
        browsingPodName: "Uptown",
      })
    ).toBe(true);
  });

  it("hides when assigned cart is current context in drawer", () => {
    expect(
      shouldShowActiveRecoverySection({
        ...base,
        scope: "assigned_pod",
        cart: soloCart,
        activeCartRecovery: buildActiveCartRecovery({
          cart: soloCart,
          browsePodId: "pod_a",
          browsePodName: "Downtown",
        }),
      })
    ).toBe(false);
  });
});

describe("recoveryItemCountLabel", () => {
  it("pluralizes items", () => {
    expect(recoveryItemCountLabel(1)).toBe("1 item");
    expect(recoveryItemCountLabel(3)).toBe("3 items");
  });
});

describe("shouldShowActiveRecovery", () => {
  const recovery = buildActiveCartRecovery({
    cart: soloCart,
    browsePodId: "pod_b",
    browsePodName: "Uptown",
  });

  it("shows for browse conflict", () => {
    expect(shouldShowActiveRecovery(recovery, "browsing_pod", true)).toBe(true);
  });

  it("hides group recovery on neutral scope", () => {
    const groupRecovery = buildActiveCartRecovery({
      cart: {
        ...soloCart,
        groupOrder: { role: "host", canCheckout: true, joinCode: "111111" },
      },
      browsePodId: null,
      browsePodName: null,
    });
    expect(shouldShowActiveRecovery(groupRecovery, "neutral", false)).toBe(false);
  });
});

describe("shouldSuppressNeutralGroupPromo", () => {
  it("suppresses for group host and participant recovery", () => {
    expect(
      shouldSuppressNeutralGroupPromo(
        buildActiveCartRecovery({
          cart: { ...soloCart, groupOrder: { role: "host", canCheckout: true, joinCode: "111111" } },
          browsePodId: null,
          browsePodName: null,
        })
      )
    ).toBe(true);
    expect(
      shouldSuppressNeutralGroupPromo(
        buildActiveCartRecovery({
          cart: { ...soloCart, groupOrder: { role: "participant", canCheckout: false } },
          browsePodId: null,
          browsePodName: null,
        })
      )
    ).toBe(true);
    expect(
      shouldSuppressNeutralGroupPromo(
        buildActiveCartRecovery({ cart: soloCart, browsePodId: null, browsePodName: null })
      )
    ).toBe(false);
  });
});
