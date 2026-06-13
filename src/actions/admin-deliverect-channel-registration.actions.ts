"use server";

export {
  adminApplyChannelRegistrationPayloadToVendor,
  adminRetryChannelRegistrationMatch,
} from "@/actions/admin-deliverect-connections.actions";

export type { AdminRetryChannelRegistrationResult } from "@/actions/admin-deliverect-connections.actions";

export type AdminApplyChannelRegistrationResult =
  | { ok: true; outcome: string; vendorId: string; channelLinkId: string }
  | {
      ok: false;
      error: string;
      conflicts?: import("@/services/admin-deliverect-connection.service").DeliverectConnectionOwner[];
    };
