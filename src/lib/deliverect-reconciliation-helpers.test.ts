import { describe, expect, it } from "vitest";
import {
  describeDeliverectReconciliationForAdmin,
  getDeliverectReconciliationPhase,
  isAwaitingDeliverectReconciliation,
  isDeliverectReconciliationOverdue,
  lastDeliverectResponsePendingWebhookFlag,
  minutesSinceDeliverectSubmit,
} from "./deliverect-reconciliation-helpers";

describe("deliverect-reconciliation-helpers", () => {
  it("flags pending webhook marker in stored response", () => {
    expect(lastDeliverectResponsePendingWebhookFlag(null)).toBe(false);
    expect(
      lastDeliverectResponsePendingWebhookFlag({ _mennyu: { deliverectOrderIdPendingWebhook: true } })
    ).toBe(true);
  });

  it("isAwaitingDeliverectReconciliation: sent + no external + pending fulfillment", () => {
    expect(
      isAwaitingDeliverectReconciliation({
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        lastExternalStatusAt: null,
      })
    ).toBe(true);
    expect(
      isAwaitingDeliverectReconciliation({
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        lastExternalStatusAt: new Date(),
      })
    ).toBe(false);
    expect(
      isAwaitingDeliverectReconciliation({
        routingStatus: "confirmed",
        fulfillmentStatus: "pending",
        lastExternalStatusAt: null,
      })
    ).toBe(false);
  });

  it("overdue only when past threshold and still awaiting", () => {
    const submitted = new Date("2026-01-01T12:00:00.000Z");
    const vo = {
      routingStatus: "sent" as const,
      fulfillmentStatus: "pending" as const,
      lastExternalStatusAt: null as Date | null,
      deliverectSubmittedAt: submitted,
    };
    expect(isDeliverectReconciliationOverdue(vo, 25, new Date("2026-01-01T12:24:59.000Z"))).toBe(false);
    expect(isDeliverectReconciliationOverdue(vo, 25, new Date("2026-01-01T12:25:00.000Z"))).toBe(true);
  });

  it("getDeliverectReconciliationPhase", () => {
    const submitted = new Date("2026-01-01T12:00:00.000Z");
    const awaiting = {
      routingStatus: "sent" as const,
      fulfillmentStatus: "pending" as const,
      lastExternalStatusAt: null as Date | null,
      deliverectSubmittedAt: submitted,
    };
    expect(getDeliverectReconciliationPhase(awaiting, { staleMinutes: 25, now: new Date("2026-01-01T12:10:00.000Z") })).toBe(
      "awaiting_reconciliation"
    );
    expect(getDeliverectReconciliationPhase(awaiting, { staleMinutes: 25, now: new Date("2026-01-01T12:30:00.000Z") })).toBe(
      "overdue_reconciliation"
    );
    expect(
      getDeliverectReconciliationPhase(
        { ...awaiting, lastExternalStatusAt: new Date("2026-01-01T12:30:00.000Z") },
        { staleMinutes: 25, now: new Date("2026-01-01T12:30:00.000Z") }
      )
    ).toBe("reconciled");
  });

  it("describeDeliverectReconciliationForAdmin: awaiting uses soft wording", () => {
    const submitted = new Date("2026-01-01T12:00:00.000Z");
    const now = new Date("2026-01-01T12:10:00.000Z");
    const text = describeDeliverectReconciliationForAdmin(
      {
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        lastExternalStatusAt: null,
        deliverectSubmittedAt: submitted,
      },
      { now, staleMinutes: 25 }
    );
    expect(text).toContain("awaiting first POS webhook");
    expect(text).not.toContain("No POS webhook confirmation after");
  });

  it("describeDeliverectReconciliationForAdmin: overdue uses strong wording", () => {
    const submitted = new Date("2026-01-01T12:00:00.000Z");
    const now = new Date("2026-01-01T12:50:00.000Z");
    const text = describeDeliverectReconciliationForAdmin(
      {
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        lastExternalStatusAt: null,
        deliverectSubmittedAt: submitted,
      },
      { now, staleMinutes: 25 }
    );
    expect(text).toContain("No POS webhook confirmation after");
    expect(text).toContain("Past expected webhook window");
  });

  it("minutesSinceDeliverectSubmit", () => {
    const submitted = new Date("2026-01-01T12:00:00.000Z");
    expect(
      minutesSinceDeliverectSubmit(
        { routingStatus: "sent", deliverectSubmittedAt: submitted },
        new Date("2026-01-01T12:30:00.000Z")
      )
    ).toBe(30);
  });
});
