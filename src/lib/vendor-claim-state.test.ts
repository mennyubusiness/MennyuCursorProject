import { describe, expect, it } from "vitest";
import { getVendorClaimState } from "@/lib/vendor-claim-state";

const future = new Date("2030-01-01T00:00:00.000Z");
const past = new Date("2020-01-01T00:00:00.000Z");
const now = new Date("2025-01-01T00:00:00.000Z");

describe("getVendorClaimState", () => {
  it("derives unclaimed from zero owner memberships", () => {
    expect(getVendorClaimState({ memberships: [], now }).key).toBe("unclaimed");
  });

  it("does not count staff access as a claim", () => {
    expect(getVendorClaimState({ memberships: [{ role: "staff" }], now }).key).toBe("unclaimed");
  });

  it("derives invite sent from an active invitation", () => {
    expect(
      getVendorClaimState({
        memberships: [],
        claimInvite: { expiresAt: future, claimedAt: null, revokedAt: null },
        now,
      }).key
    ).toBe("invite_pending");
  });

  it("derives expiration without persisting another status", () => {
    expect(
      getVendorClaimState({
        memberships: [],
        claimInvite: { expiresAt: past, claimedAt: null, revokedAt: null },
        now,
      }).key
    ).toBe("invite_expired");
  });

  it("owner membership always makes the vendor claimed", () => {
    const state = getVendorClaimState({
      memberships: [{ role: "staff" }, { role: "owner" }],
      claimInvite: { expiresAt: past, claimedAt: null, revokedAt: null },
      now,
    });
    expect(state).toMatchObject({ key: "claimed", claimed: true, ownerCount: 1 });
  });

  it("a revoked invitation returns to unclaimed", () => {
    expect(
      getVendorClaimState({
        memberships: [],
        claimInvite: { expiresAt: future, claimedAt: null, revokedAt: now },
        now,
      }).key
    ).toBe("unclaimed");
  });
});
