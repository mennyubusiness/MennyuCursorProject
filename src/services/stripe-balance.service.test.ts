import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    balance: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_x" },
}));

import { fetchStripePlatformBalance } from "./stripe-balance.service";

describe("fetchStripePlatformBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns available and pending cents by currency", async () => {
    mockRetrieve.mockResolvedValue({
      available: [{ currency: "usd", amount: 137 }],
      pending: [{ currency: "usd", amount: 54200 }],
    });

    const result = await fetchStripePlatformBalance("usd");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.balance.availableCents).toBe(137);
      expect(result.balance.pendingCents).toBe(54200);
      expect(result.balance.currency).toBe("usd");
      expect(result.balance.retrievedAt).toBeTruthy();
    }
  });

  it("returns error when Stripe balance fetch fails", async () => {
    mockRetrieve.mockRejectedValue(new Error("network down"));
    const result = await fetchStripePlatformBalance("usd");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("network down");
  });
});
