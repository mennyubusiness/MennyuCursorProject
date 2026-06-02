import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionStore = new Map<string, string>();
const dispatchCartCleared = vi.fn();
const markPendingClientCartClear = vi.fn();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
  clear: () => {
    sessionStore.clear();
  },
});

vi.mock("@/lib/cart-client-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cart-client-sync")>();
  return {
    ...actual,
    dispatchCartCleared: (...args: unknown[]) => dispatchCartCleared(...args),
    markPendingClientCartClear: (...args: unknown[]) => markPendingClientCartClear(...args),
  };
});

import { clearCartOnServerAndNotifyClient } from "@/lib/cart-checkout-client";

describe("clearCartOnServerAndNotifyClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStore.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    );
  });

  it("does not dispatch client clear when server clear fails", async () => {
    await clearCartOnServerAndNotifyClient({
      cartId: "cart_1",
      podId: "pod_a",
      orderId: "ord_1",
    });

    expect(dispatchCartCleared).not.toHaveBeenCalled();
    expect(markPendingClientCartClear).toHaveBeenCalledWith({
      cartId: "cart_1",
      podId: "pod_a",
      orderId: "ord_1",
    });
  });

  it("dispatches client clear when server clear succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "cart_1",
          podId: "pod_a",
          sessionId: "sess_1",
          items: [],
          groups: [],
          subtotalCents: 0,
        }),
      })
    );

    await clearCartOnServerAndNotifyClient({
      cartId: "cart_1",
      podId: "pod_a",
      orderId: "ord_1",
    });

    expect(dispatchCartCleared).toHaveBeenCalledTimes(1);
    expect(markPendingClientCartClear).not.toHaveBeenCalled();
  });

  it("dispatches client clear when serverAlreadyCleared is true even if fetch fails", async () => {
    await clearCartOnServerAndNotifyClient({
      cartId: "cart_1",
      podId: "pod_a",
      orderId: "ord_1",
      serverAlreadyCleared: true,
    });

    expect(dispatchCartCleared).toHaveBeenCalledTimes(1);
    expect(markPendingClientCartClear).not.toHaveBeenCalled();
  });
});
