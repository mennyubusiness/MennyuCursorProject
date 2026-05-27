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
};

export function VendorOnboardingProgress({
  vendorId,
  posConnectionStatus,
  deliverectChannelLinkId,
  pendingDeliverectConnectionKey,
  deliverectAutoMapLastOutcome,
  hasUnmatchedChannelRegistration,
}: Props) {
  const ui = deriveVendorPosUiState({
    deliverectChannelLinkId,
    posConnectionStatus,
    deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: hasUnmatchedChannelRegistration,
  });
  const posLabel = vendorPosUiStateLabel(ui);

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 p-4 text-sm text-oo-charcoal">
      <h3 className="font-semibold text-oo-charcoal">Getting started</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <span className="font-medium text-emerald-800">Restaurant profile</span> — complete
        </li>
        <li>
          <span className="font-medium text-oo-charcoal">Payouts (Stripe)</span> —{" "}
          <span className="text-oo-stone-gray">set up when you&apos;re ready for deposits</span>
          <span className="block text-xs text-oo-stone-gray">Open Order will guide Stripe Connect here in a future update.</span>
        </li>
        <li className="text-oo-charcoal">
          <span className="font-medium">POS connection</span> — {posLabel}
          {ui !== "connected" ? (
            <>
              {" "}
              <Link href={`/vendor/${vendorId}/connect-pos`} className="font-medium text-oo-charcoal hover:underline">
                Set up POS connection
              </Link>{" "}
              — optional until you want live kitchen routing.
            </>
          ) : (
            <>
              {" "}
              —{" "}
              <Link href={`/vendor/${vendorId}/settings`} className="font-medium text-oo-charcoal hover:underline">
                manage in Settings
              </Link>
              .
            </>
          )}
        </li>
      </ol>
    </section>
  );
}
