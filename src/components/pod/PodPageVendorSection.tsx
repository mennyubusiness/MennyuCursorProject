import { PodVendorGrid, type PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import type { PodOrderingStatus } from "@/lib/pod-page-status";

type PodPageVendorSectionProps = {
  podId: string;
  podName: string;
  rows: PodVendorGridRow[];
  highlightVendorId: string | null;
  orderingStatus: PodOrderingStatus;
  showContactLink: boolean;
  contactAnchorId?: string | null;
};

export function PodPageVendorSection({
  podId,
  podName,
  rows,
  highlightVendorId,
  orderingStatus,
  showContactLink,
  contactAnchorId,
}: PodPageVendorSectionProps) {
  return (
    <PageSection className="!py-8 sm:!py-10">
      <PageShell>
        <section id="pod-vendors" aria-labelledby="pod-vendors-heading" className="scroll-mt-36">
          <header className="mb-6 max-w-2xl">
            <h2
              id="pod-vendors-heading"
              className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl"
            >
              Order from vendors at {podName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
              Choose from participating vendors and check out once across the pod.
            </p>
          </header>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-6 py-10 text-center shadow-sm">
              <p className="text-lg font-bold text-oo-charcoal">No participating vendors listed yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-oo-stone-gray">
                {podName} is on Open Order, but no kitchens are listed right now. Check back soon
                {showContactLink ? " or contact the pod for current hours" : ""}.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/explore" variant="primary" size="sm">
                  Explore pods
                </ButtonLink>
                {showContactLink && contactAnchorId && (
                  <a
                    href={`#${contactAnchorId}`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-oo-light-stone bg-oo-cream px-3.5 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-warm-white"
                  >
                    Contact pod
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              {orderingStatus.tone === "closed" && (
                <div
                  className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  Vendors are not currently accepting orders. Menus may still be browsable when
                  available.
                </div>
              )}
              {orderingStatus.tone === "limited" && (
                <div
                  className="mb-5 rounded-lg border border-oo-light-stone bg-oo-cream px-4 py-3 text-sm text-oo-charcoal"
                  role="status"
                >
                  {orderingStatus.label}. Open kitchens below — pickup timing may vary by vendor.
                </div>
              )}
              <PodVendorGrid podId={podId} rows={rows} highlightVendorId={highlightVendorId} />
            </>
          )}
        </section>
      </PageShell>
    </PageSection>
  );
}
