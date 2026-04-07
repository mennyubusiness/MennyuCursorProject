import type { PosConnectionStatus } from "@prisma/client";
import Link from "next/link";
import { effectivePosConnectionStatus, posConnectionLabel } from "@/lib/vendor-pos-connection";

type Props = {
  vendorId: string;
  posConnectionStatus: PosConnectionStatus;
  deliverectChannelLinkId: string | null;
};

export function VendorOnboardingProgress({ vendorId, posConnectionStatus, deliverectChannelLinkId }: Props) {
  const posEffective = effectivePosConnectionStatus({ posConnectionStatus, deliverectChannelLinkId });
  const posLabel = posConnectionLabel(posEffective);

  return (
    <section className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-700">
      <h3 className="font-semibold text-stone-900">Getting started</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <span className="font-medium text-emerald-800">Restaurant profile</span> — complete
        </li>
        <li>
          <span className="font-medium text-stone-800">Payouts (Stripe)</span> —{" "}
          <span className="text-stone-500">set up when you&apos;re ready for deposits</span>
          <span className="block text-xs text-stone-500">Mennyu will guide Stripe Connect here in a future update.</span>
        </li>
        <li className="text-stone-800">
          <span className="font-medium">POS connection</span> — {posLabel}
          {posEffective !== "connected" ? (
            <>
              {" "}
              <Link href={`/vendor/${vendorId}/connect-pos`} className="font-medium text-mennyu-primary hover:underline">
                Connect your POS
              </Link>{" "}
              when you can — optional, manual mode always available.
            </>
          ) : (
            <span className="text-stone-500"> — you can update details anytime.</span>
          )}
        </li>
      </ol>
    </section>
  );
}
