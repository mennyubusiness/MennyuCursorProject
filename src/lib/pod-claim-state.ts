import type { PodMembershipRole } from "@prisma/client";

export type PodClaimStateKey =
  | "unclaimed"
  | "invite_pending"
  | "invite_expired"
  | "claimed";

export type PodClaimState = {
  key: PodClaimStateKey;
  label: "Unclaimed" | "Invite sent" | "Invite expired" | "Claimed";
  claimed: boolean;
  ownerCount: number;
};

type MembershipLike = { role: PodMembershipRole | string };
type InviteLike = {
  expiresAt: Date;
  claimedAt: Date | null;
  revokedAt: Date | null;
} | null;

/** Ownership is role-aware: manager access does not make the pod claimed. */
export function getPodClaimState(input: {
  memberships: MembershipLike[];
  claimInvite?: InviteLike;
  now?: Date;
}): PodClaimState {
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
