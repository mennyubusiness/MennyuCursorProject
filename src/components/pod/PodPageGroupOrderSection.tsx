import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { getPodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";
import { PageBand, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";

export async function PodPageGroupOrderSection({ podId }: { podId: string }) {
  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  return (
    <PageBand variant="muted" className="border-t-0">
      <section id="pod-group-order" className="scroll-mt-36">
        <PageShell className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          {ctaState.kind === "start" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-oo-charcoal">Ordering with friends?</p>
                <p className="mt-0.5 text-sm text-oo-stone-gray">
                  Start a group order — everyone adds to one shared cart.
                </p>
              </div>
              <ButtonLink href={groupOrderHref} size="sm" className="shrink-0 self-start sm:self-center">
                Start group order
              </ButtonLink>
            </>
          ) : ctaState.kind === "host_active" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-oo-charcoal">Group order started</p>
                <p className="mt-0.5 text-sm text-oo-stone-gray">
                  Open Quick Cart to invite friends or add items.
                </p>
              </div>
              <ButtonLink href="/cart" size="sm" variant="secondary" className="shrink-0 self-start sm:self-center">
                Open group cart
              </ButtonLink>
            </>
          ) : ctaState.kind === "participant_active" ? (
            <div>
              <p className="text-sm font-semibold text-oo-charcoal">You&apos;re in a group order</p>
              <p className="mt-0.5 text-sm text-oo-stone-gray">
                Add your items before the host checks out.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-oo-charcoal">Host is checking out</p>
              <p className="mt-0.5 text-sm text-oo-stone-gray">
                New changes are paused until checkout finishes.
              </p>
            </div>
          )}
        </PageShell>
      </section>
    </PageBand>
  );
}
