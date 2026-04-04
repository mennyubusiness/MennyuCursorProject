import { describe, expect, it } from "vitest";
import { buildDeliverectAdminLifecycle } from "./deliverect-admin-lifecycle";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "./admin-exceptions";

const base = {
  fulfillmentStatus: "pending" as const,
  deliverectOrderId: null as string | null,
  lastDeliverectResponse: null,
  deliverectSubmittedAt: null as Date | null,
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  deliverectChannelLinkId: "ch1",
  vendorDeliverectChannelLinkId: null as string | null,
  manuallyRecoveredAt: null as Date | null,
  statusAuthority: null as null,
  lastStatusSource: null as null,
  deliverectAutoRecheckAttemptedAt: null as Date | null,
  deliverectAutoRecheckResult: null as string | null,
};

describe("buildDeliverectAdminLifecycle", () => {
  it("manual recovery wins", () => {
    const life = buildDeliverectAdminLifecycle({
      ...base,
      routingStatus: "sent",
      lastExternalStatusAt: null,
      manuallyRecoveredAt: new Date(),
    });
    expect(life.phaseKey).toBe("manually_recovered");
  });

  it("routing failed", () => {
    const life = buildDeliverectAdminLifecycle({
      ...base,
      routingStatus: "failed",
      lastExternalStatusAt: null,
    });
    expect(life.phaseKey).toBe("routing_failed");
  });

  it("overdue when past stale window from submit", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const life = buildDeliverectAdminLifecycle(
      {
        ...base,
        routingStatus: "sent",
        lastExternalStatusAt: null,
        deliverectSubmittedAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      { now, staleMinutes: DELIVERECT_RECONCILIATION_STALE_MINUTES }
    );
    expect(life.phaseKey).toBe("reconciliation_overdue");
    expect(life.overdueReconciliation).toBe(true);
  });

  it("webhook reconciled with late flag", () => {
    const life = buildDeliverectAdminLifecycle({
      ...base,
      routingStatus: "sent",
      lastExternalStatusAt: new Date("2026-01-01T11:00:00.000Z"),
      deliverectSubmittedAt: new Date("2026-01-01T10:00:00.000Z"),
      lastStatusSource: "deliverect_webhook",
      lastExternalStatus: "86",
    });
    expect(life.phaseKey).toBe("reconciled_webhook");
    expect(life.reconciledLate).toBe(true);
  });
});
