import type { PosConnectionStatus } from "@prisma/client";
import Link from "next/link";
import { deriveVendorPosUiState, vendorPosUiStateLabel } from "@/lib/vendor-pos-ui-state";

type Props = {
  vendorId: string;
  posConnectionStatus: PosConnectionStatus;
  deliverectChannelLinkId: string | null;
  pendingDeliverectConnectionKey: string | null;
  deliverectAutoMapLastOutcome: string | null;
  hasUnmatchedChannelRegistration: boolean;
  stripeConnectedAccountId: string | null;
  stripePayoutsEnabled: boolean;
  pendingPodInviteCount: number;
};

export function VendorOnboardingProgress({
  vendorId,
  posConnectionStatus,
  deliverectChannelLinkId,
  pendingDeliverectConnectionKey,
  deliverectAutoMapLastOutcome,
  hasUnmatchedChannelRegistration,
  stripeConnectedAccountId,
  stripePayoutsEnabled,
  pendingPodInviteCount,
}: Props) {
  const ui = deriveVendorPosUiState({
    deliverectChannelLinkId,
    posConnectionStatus,
    deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: hasUnmatchedChannelRegistration,
  });
  const posLabel = vendorPosUiStateLabel(ui);
  const stripeReady = Boolean(stripeConnectedAccountId?.trim()) && stripePayoutsEnabled;

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 p-4 text-sm text-oo-charcoal">
      <h3 className="font-semibold text-oo-charcoal">Getting started</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <span className="font-medium text-oo-charcoal">Complete your vendor profile</span>
          <span className="text-oo-stone-gray"> — name, logo, and colors on your pod menu.</span>
        </li>
        <li>
          <span className="font-medium text-oo-charcoal">Connect Stripe to receive payouts</span>
          {stripeReady ? (
            <span className="text-emerald-800"> — connected</span>
          ) : (
            <>
              {" "}
              —{" "}
              <Link
                href={`/vendor/${vendorId}/settings#vendor-settings-payouts`}
                className="font-medium text-oo-charcoal hover:underline"
              >
                set up payouts in Settings
              </Link>
            </>
          )}
        </li>
        <li>
          <span className="font-medium text-oo-charcoal">Connect or confirm your POS/menu connection</span>
          {" — "}
          {posLabel}
          {ui !== "connected" ? (
            <>
              {" "}
              <Link href={`/vendor/${vendorId}/connect-pos`} className="font-medium text-oo-charcoal hover:underline">
                Connect POS
              </Link>
            </>
          ) : (
            <>
              {" "}
              <Link href={`/vendor/${vendorId}/settings#vendor-settings-pos`} className="font-medium text-oo-charcoal hover:underline">
                review in Settings
              </Link>
            </>
          )}
        </li>
        <li>
          <span className="font-medium text-oo-charcoal">Accept pod invitations</span>
          {pendingPodInviteCount > 0 ? (
            <span className="text-amber-900">
              {" "}
              — {pendingPodInviteCount} pending invitation{pendingPodInviteCount === 1 ? "" : "s"} below
            </span>
          ) : (
            <span className="text-oo-stone-gray"> — respond to invites from pod owners in this page.</span>
          )}
        </li>
        <li>
          <span className="font-medium text-oo-charcoal">Use Kitchen Mode to manage orders</span>
          {" — "}
          <Link href={`/vendor/${vendorId}/orders`} className="font-medium text-oo-charcoal hover:underline">
            open Orders
          </Link>
          .
        </li>
      </ol>
    </section>
  );
}
