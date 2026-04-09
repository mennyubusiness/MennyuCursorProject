"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import {
  findLatestUnmatchedWebhookEventIdForVendorById,
  retryChannelRegistrationMatchForWebhookEventById,
} from "@/services/deliverect-channel-registration-retry.service";

export type VendorPosRetryResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Re-runs exact matching for the latest stored channel-registration webhook that referenced this vendor’s
 * Mennyu Location ID but did not match. Does not bypass webhook idempotency for new deliveries — only reprocesses DB state.
 */
export async function retryVendorDeliverectConnection(vendorId: string): Promise<VendorPosRetryResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  if (!(await canManageVendor(userId, vendorId))) {
    return { ok: false, error: "You don’t have permission to update this restaurant." };
  }

  const webhookEventId = await findLatestUnmatchedWebhookEventIdForVendorById(vendorId);
  if (!webhookEventId) {
    return {
      ok: false,
      error: "There’s nothing to retry right now. If Deliverect just activated, wait a moment or confirm your Mennyu Location ID is entered in Deliverect.",
    };
  }

  const result = await retryChannelRegistrationMatchForWebhookEventById(webhookEventId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (result.outcome === "still_no_match") {
    return {
      ok: false,
      error:
        "We still couldn’t match this activation. Double-check that your Mennyu Location ID is pasted exactly into Deliverect’s channel location field, then contact support if it continues.",
    };
  }

  if (result.outcome === "ambiguous") {
    return {
      ok: false,
      error: "Multiple accounts could match — an admin needs to connect this manually.",
    };
  }

  revalidatePath(`/vendor/${vendorId}/connect-pos`);
  revalidatePath(`/vendor/${vendorId}/orders`);
  revalidatePath(`/vendor/${vendorId}/settings`);

  return {
    ok: true,
    message:
      result.outcome === "already_connected"
        ? "Your connection is already up to date."
        : "Connected. Your POS channel link is now linked to this restaurant.",
  };
}
