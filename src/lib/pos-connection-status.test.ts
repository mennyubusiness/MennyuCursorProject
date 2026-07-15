import { describe, expect, it } from "vitest";
import {
  buildVendorPosReadinessFallback,
  normalizePosConnectionStatus,
} from "@/lib/pos-connection-status";

describe("normalizePosConnectionStatus", () => {
  it("keeps canonical PosConnectionStatus values", () => {
    expect(normalizePosConnectionStatus("connected")).toBe("connected");
    expect(normalizePosConnectionStatus("error")).toBe("error");
    expect(normalizePosConnectionStatus("not_connected")).toBe("not_connected");
    expect(normalizePosConnectionStatus("onboarding")).toBe("onboarding");
  });

  it("maps legacy pending to onboarding", () => {
    expect(normalizePosConnectionStatus("pending")).toBe("onboarding");
  });

  it("defaults null, undefined, and unknown values to not_connected", () => {
    expect(normalizePosConnectionStatus(null)).toBe("not_connected");
    expect(normalizePosConnectionStatus(undefined)).toBe("not_connected");
    expect(normalizePosConnectionStatus("")).toBe("not_connected");
    expect(normalizePosConnectionStatus("weird")).toBe("not_connected");
  });
});

describe("buildVendorPosReadinessFallback", () => {
  it("returns a VendorPosReadinessSummary with normalized fields", () => {
    const fallback = buildVendorPosReadinessFallback({
      posConnectionStatus: "pending",
      deliverectChannelLinkId: "ch_1",
      orderRoutingMode: "square",
      menuSource: "open_order",
    });

    expect(fallback.posConnectionStatus).toBe("onboarding");
    expect(fallback.deliverectChannelLinkId).toBe("ch_1");
    expect(fallback.orderRoutingMode).toBe("square");
    expect(fallback.menuSource).toBe("open_order");
    expect(fallback.hasUnmatchedChannelRegistration).toBe(false);
    expect(fallback.deliverectAutoMapLastOutcome).toBeNull();
    expect(fallback.pendingDeliverectConnectionKey).toBeNull();
  });
});
