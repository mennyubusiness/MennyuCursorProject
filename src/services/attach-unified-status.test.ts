import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react")>();
  return { ...mod, cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn };
});

import { attachUnifiedStatusDerivedFields } from "./order-status.service";

describe("attachUnifiedStatusDerivedFields", () => {
  it("derives in_progress from vendor children when parent history is empty", () => {
    const order = {
      status: "in_progress" as const,
      pod: { pickupTimezone: "America/Chicago" },
      statusHistory: [] as Array<{ status: string; createdAt: Date }>,
      vendorOrders: [
        {
          routingStatus: "confirmed",
          fulfillmentStatus: "preparing",
          statusHistory: [],
        },
      ],
    };
    const out = attachUnifiedStatusDerivedFields(order);
    expect(out.derivedStatus).toBe("in_progress");
    expect(out.resolvedPickupTimezone).toBe("America/Chicago");
  });
});
