import { PageShell } from "@/components/layout/page-shell";

type PodQrEntryBannerProps = {
  podName: string;
};

/** Direct-ordering message when customers arrive via pod QR (?entry=qr). */
export function PodQrEntryBanner({ podName }: PodQrEntryBannerProps) {
  return (
    <PageShell className="py-3 sm:py-4">
      <div
        className="rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-oo-charcoal"
        role="status"
      >
        <p className="font-semibold text-oo-charcoal">Order from {podName}</p>
        <p className="mt-1 leading-relaxed text-oo-stone-gray">
          Pick a vendor below — multiple kitchens, one cart, one checkout, one pickup.
        </p>
      </div>
    </PageShell>
  );
}
