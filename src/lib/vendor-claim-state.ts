import type { VendorMembershipRole } from "@prisma/client";

export type VendorClaimStateKey =
  | "unclaimed"
  | "invite_pending"
  | "invite_expired"
  | "claimed";

export type VendorClaimState = {
  key: VendorClaimStateKey;
  label: "Unclaimed" | "Invite sent" | "Invite expired" | "Claimed";
  claimed: boolean;
  ownerCount: number;
};

type MembershipLike = { role: VendorMembershipRole | string };
type InviteLike = {
  expiresAt: Date;
  claimedAt: Date | null;
  revokedAt: Date | null;
} | null;

/** Ownership is role-aware: staff access does not make the business claimed. */
export function getVendorClaimState(input: {
  memberships: MembershipLike[];
  claimInvite?: InviteLike;
  now?: Date;
}): VendorClaimState {
  const ownerCount = input.memberships.filter((membership) => membership.role === "owner").length;
  if (ownerCount > 0) {
    return { key: "claimed", label: "Claimed", claimed: true, ownerCount };
  }

  const invite = input.claimInvite ?? null;
  if (invite && !invite.claimedAt && !invite.revokedAt) {
    if (invite.expiresAt <= (input.now ?? new Date())) {
      return { key: "invite_expired", label: "Invite expired", claimed: false, ownerCount: 0 };
    }
    return { key: "invite_pending", label: "Invite sent", claimed: false, ownerCount: 0 };
  }

  return { key: "unclaimed", label: "Unclaimed", claimed: false, ownerCount: 0 };
}
