export type PodVendorInvitePublicView =
  | {
      ok: true;
      status: "pending";
      podId: string;
      podName: string;
      invitedVendorName: string | null;
      invitedEmail: string;
      expiresAt: string;
    }
  | {
      ok: true;
      status: "accepted" | "cancelled" | "expired";
      podName: string;
      invitedVendorName: string | null;
    }
  | { ok: false; reason: "invalid" };
