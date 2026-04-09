import { describe, expect, it } from "vitest";
import { deriveVendorPosUiState, vendorPosUiStateGuidance, vendorPosUiStateLabel } from "./vendor-pos-ui-state";

describe("deriveVendorPosUiState", () => {
  const base = {
    deliverectChannelLinkId: null as string | null,
    posConnectionStatus: "not_connected" as const,
    deliverectAutoMapLastOutcome: null as string | null,
    pendingDeliverectConnectionKey: null as string | null,
    hasUnmatchedChannelRegistrationForVendor: false,
  };

  it("returns connected when channel link id is set", () => {
    expect(
      deriveVendorPosUiState({
        ...base,
        deliverectChannelLinkId: "cl-1",
        posConnectionStatus: "onboarding",
        hasUnmatchedChannelRegistrationForVendor: true,
      })
    ).toBe("connected");
  });

  it("returns waiting_for_activation when onboarding without channel", () => {
    expect(
      deriveVendorPosUiState({
        ...base,
        posConnectionStatus: "onboarding",
        pendingDeliverectConnectionKey: "k1",
      })
    ).toBe("waiting_for_activation");
  });

  it("returns needs_attention when unmatched registration references this vendor", () => {
    expect(
      deriveVendorPosUiState({
        ...base,
        posConnectionStatus: "onboarding",
        pendingDeliverectConnectionKey: "k1",
        hasUnmatchedChannelRegistrationForVendor: true,
      })
    ).toBe("needs_attention");
  });

  it("returns needs_attention on integration error", () => {
    expect(
      deriveVendorPosUiState({
        ...base,
        posConnectionStatus: "error",
      })
    ).toBe("needs_attention");
  });

  it("returns needs_attention on channel_link_conflict outcome", () => {
    expect(
      deriveVendorPosUiState({
        ...base,
        deliverectAutoMapLastOutcome: "channel_link_conflict",
      })
    ).toBe("needs_attention");
  });

  it("returns not_connected by default", () => {
    expect(deriveVendorPosUiState(base)).toBe("not_connected");
  });
});

describe("vendorPosUiStateGuidance", () => {
  it("mentions Deliverect when unmatched", () => {
    const g = vendorPosUiStateGuidance("needs_attention", { hasUnmatchedRegistration: true });
    expect(g.toLowerCase()).toContain("deliverect");
  });
});

describe("vendorPosUiStateLabel", () => {
  it("labels waiting state", () => {
    expect(vendorPosUiStateLabel("waiting_for_activation")).toBe("Waiting for activation");
  });
});
