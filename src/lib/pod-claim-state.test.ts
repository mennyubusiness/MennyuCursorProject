import { describe, expect, it } from "vitest";
import { getPodClaimState } from "@/lib/pod-claim-state";

const future = new Date("2030-01-01T00:00:00.000Z");
const past = new Date("2020-01-01T00:00:00.000Z");
const now = new Date("2025-01-01T00:00:00.000Z");

describe("getPodClaimState", () => {
  it("derives unclaimed from zero owner memberships", () => {
    expect(getPodClaimState({ memberships: [], now }).key).toBe("unclaimed");
  });

  it("does not count manager access as a claim", () => {
    expect(getPodClaimState({ memberships: [{ role: "manager" }], now }).key).toBe("unclaimed");
  });

  it("derives invite sent from an active invitation", () => {
    expect(
      getPodClaimState({
        memberships: [],
        claimInvite: { expiresAt: future, claimedAt: null, revokedAt: null },
        now,
      }).key
    ).toBe("invite_pending");
  });

  it("derives expiration without persisting another status", () => {
    expect(
      getPodClaimState({
        memberships: [],
        claimInvite: { expiresAt: past, claimedAt: null, revokedAt: null },
        now,
      }).key
    ).toBe("invite_expired");
  });

  it("owner membership always makes the pod claimed", () => {
    const state = getPodClaimState({
      memberships: [{ role: "manager" }, { role: "owner" }],
      claimInvite: { expiresAt: past, claimedAt: null, revokedAt: null },
      now,
    });
    expect(state).toMatchObject({ key: "claimed", claimed: true, ownerCount: 1 });
  });

  it("a revoked invitation returns to unclaimed", () => {
    expect(
      getPodClaimState({
        memberships: [],
        claimInvite: { expiresAt: future, claimedAt: null, revokedAt: now },
        now,
      }).key
    ).toBe("unclaimed");
  });
});
