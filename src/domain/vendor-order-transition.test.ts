import { describe, expect, it } from "vitest";
import { getVendorOrderBoardGroupKey } from "@/lib/vendor-orders-board";
import {
  getAllowedProgressionTargets,
  targetToUpdate,
  validateTransition,
  type VendorOrderTargetState,
} from "./vendor-order-transition";

function boardGroup(routing: string, fulfillment: string) {
  return getVendorOrderBoardGroupKey({ routingStatus: routing, fulfillmentStatus: fulfillment });
}

describe("validateTransition — fulfillment progression", () => {
  it("allows accepted only after routing is sent or confirmed", () => {
    expect(validateTransition("pending", "pending", "accepted")).toMatch(/Routing must be sent or confirmed/);
    expect(validateTransition("sent", "pending", "accepted")).toBeNull();
    expect(validateTransition("confirmed", "pending", "accepted")).toBeNull();
  });

  it("moves accepted fulfillment to preparing", () => {
    expect(validateTransition("confirmed", "accepted", "preparing")).toBeNull();
    expect(targetToUpdate("preparing")).toEqual({ fulfillmentStatus: "preparing" });
  });

  it("keeps preparing as valid in-place progression toward ready", () => {
    expect(validateTransition("confirmed", "preparing", "preparing")).toMatch(/Only accepted can transition to preparing/);
    expect(validateTransition("confirmed", "preparing", "ready")).toBeNull();
  });

  it("moves ready fulfillment to completed", () => {
    expect(validateTransition("confirmed", "ready", "completed")).toBeNull();
    expect(targetToUpdate("completed")).toEqual({ fulfillmentStatus: "completed" });
  });

  it("blocks backwards fulfillment transitions", () => {
    expect(validateTransition("confirmed", "ready", "preparing")).not.toBeNull();
    expect(validateTransition("confirmed", "completed", "ready")).toMatch(/terminal/);
    expect(validateTransition("confirmed", "preparing", "accepted")).not.toBeNull();
  });
});

describe("validateTransition — terminal states", () => {
  it("blocks further transitions after completed", () => {
    expect(validateTransition("confirmed", "completed", "ready")).toMatch(/terminal/);
    expect(validateTransition("confirmed", "completed", "cancelled")).toMatch(/terminal/);
  });

  it("blocks further transitions after cancelled", () => {
    expect(validateTransition("failed", "cancelled", "accepted")).toMatch(/terminal/);
  });

  it("allows admin cancel from failed routing with pending fulfillment", () => {
    expect(validateTransition("failed", "pending", "cancelled", "admin")).toBeNull();
  });
});

describe("validateTransition — routing failure terminal gate", () => {
  it("blocks normal progression when routing failed and fulfillment still pending", () => {
    expect(validateTransition("failed", "pending", "accepted")).toMatch(/terminal \(failed\)/);
    expect(validateTransition("failed", "pending", "preparing")).toMatch(/terminal \(failed\)/);
  });

  it("allows fulfillment progression after manual recovery from failed routing", () => {
    expect(validateTransition("failed", "pending", "accepted", "admin_manual_recovery")).toBeNull();
    expect(validateTransition("failed", "accepted", "preparing", undefined, true)).toBeNull();
  });
});

describe("validateTransition — routing lifecycle", () => {
  it("allows pending → sent → confirmed", () => {
    expect(validateTransition("pending", "pending", "sent")).toBeNull();
    expect(validateTransition("sent", "pending", "confirmed")).toBeNull();
  });

  it("blocks invalid routing regressions", () => {
    expect(validateTransition("confirmed", "pending", "sent")).toMatch(/Only pending can transition to sent/);
    expect(validateTransition("sent", "pending", "sent")).toMatch(/Only pending can transition to sent/);
  });
});

describe("getAllowedProgressionTargets", () => {
  it("offers confirmed but not accepted while routing pending and fulfillment pending", () => {
    const targets = getAllowedProgressionTargets("pending", "pending");
    expect(targets).toContain("confirmed");
    expect(targets).not.toContain("accepted");
    expect(targets).not.toContain("preparing");
  });

  it("offers accepted once routing is sent with pending fulfillment", () => {
    const targets = getAllowedProgressionTargets("sent", "pending");
    expect(targets).toContain("accepted");
    expect(targets).not.toContain("preparing");
  });

  it("offers preparing only from accepted fulfillment", () => {
    expect(getAllowedProgressionTargets("confirmed", "accepted")).toContain("preparing");
    expect(getAllowedProgressionTargets("confirmed", "pending")).not.toContain("preparing");
  });
});

describe("vendor order transition ↔ kitchen board grouping", () => {
  const newRoutingStates = ["pending", "sent", "confirmed"] as const;

  it.each(newRoutingStates)(
    "routing %s + pending fulfillment stays on New board until accepted",
    (routing) => {
      expect(boardGroup(routing, "pending")).toBe("new");
      expect(validateTransition(routing, "pending", "preparing")).not.toBeNull();
    }
  );

  it("accepted moves to Preparing board column", () => {
    expect(boardGroup("confirmed", "accepted")).toBe("preparing");
    expect(validateTransition("confirmed", "accepted", "preparing")).toBeNull();
  });

  it("preparing stays in Preparing board column", () => {
    expect(boardGroup("confirmed", "preparing")).toBe("preparing");
  });

  it("ready moves to Ready board column", () => {
    expect(boardGroup("confirmed", "ready")).toBe("ready");
    expect(validateTransition("confirmed", "ready", "completed")).toBeNull();
  });

  it("completed and cancelled leave active board columns", () => {
    expect(boardGroup("confirmed", "completed")).toBe("completed");
    expect(boardGroup("failed", "cancelled")).toBe("cancelled_failed");
    const terminalTargets: VendorOrderTargetState[] = [
      "accepted",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ];
    for (const target of terminalTargets) {
      expect(validateTransition("confirmed", "completed", target)).toMatch(/terminal/);
    }
  });
});
