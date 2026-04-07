import Link from "next/link";
import type { PosConnectionStatus } from "@prisma/client";
import { effectivePosConnectionStatus, posConnectionLabel } from "@/lib/vendor-pos-connection";

type Props = {
  vendorId: string;
  vendorName: string;
  posConnectionStatus: PosConnectionStatus;
  deliverectChannelLinkId: string | null;
};

export function VendorPosIntegrationCard({
  vendorId,
  vendorName,
  posConnectionStatus,
  deliverectChannelLinkId,
}: Props) {
  const effective = effectivePosConnectionStatus({ posConnectionStatus, deliverectChannelLinkId });
  const statusLabel = posConnectionLabel(effective);
  const connectHref = `/vendor/${vendorId}/connect-pos`;

  const tone =
    effective === "connected"
      ? "border-emerald-200 bg-emerald-50/60"
      : effective === "onboarding"
        ? "border-amber-200 bg-amber-50/50"
        : "border-stone-200 bg-white";

  return (
    <section className={`rounded-xl border p-5 shadow-sm ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-stone-900">POS &amp; orders</h3>
          <p className="mt-1 text-sm text-stone-600">
            <span className="font-medium text-stone-800">{vendorName}</span> — kitchen routing and status updates
            when your POS is linked.
          </p>
          <p className="mt-2 text-sm text-stone-700">
            Status: <span className="font-medium">{statusLabel}</span>
            {effective === "not_connected" ? (
              <span className="text-stone-500"> — you can still manage orders manually.</span>
            ) : null}
          </p>
        </div>
        <Link
          href={connectHref}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          {effective === "connected" ? "Update POS connection" : "Connect your POS"}
        </Link>
      </div>
    </section>
  );
}
