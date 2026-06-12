import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { getPodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";
import { PageBand, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import {
  PodPageOpenQuickCartButton,
  PodPageStartGroupOrderButton,
} from "@/components/pod/PodPageGroupOrderCtaClient";

export async function PodPageGroupOrderSection({ podId }: { podId: string }) {
  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);
  const joinHref = `/group-order/join?podId=${encodeURIComponent(podId)}`;

  return (
    <PageBand variant="muted" className="border-t-0">
      <section id="pod-group-order" className="scroll-mt-36">
        <PageShell className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          {ctaState.kind === "start" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-oo-charcoal">Ordering with a group?</p>
                <p className="mt-1 text-sm text-oo-stone-gray">
                  Start a shared cart for your table, or join with a code from your host.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {session?.user ? (
                  <PodPageStartGroupOrderButton podId={podId} fallbackHref={groupOrderCartUrl} />
                ) : (
                  <ButtonLink href={groupOrderHref} size="sm" className="shrink-0">
                    Start group order
                  </ButtonLink>
                )}
                <ButtonLink href={joinHref} variant="outline" size="sm" className="shrink-0">
                  Join with a code
                </ButtonLink>
              </div>
            </div>
          ) : ctaState.kind === "host_active" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-oo-charcoal">Group order started</p>
                <p className="mt-1 text-sm text-oo-stone-gray">
                  Open Quick Cart to invite friends or add items.
                </p>
              </div>
              <PodPageOpenQuickCartButton />
            </div>
          ) : ctaState.kind === "participant_active" ? (
            <div>
              <p className="text-sm font-bold text-oo-charcoal">You&apos;re in a group order</p>
              <p className="mt-1 text-sm text-oo-stone-gray">
                Add your items before the host checks out.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold text-oo-charcoal">Host is checking out</p>
              <p className="mt-1 text-sm text-oo-stone-gray">
                New changes are paused until checkout finishes.
              </p>
            </div>
          )}
        </PageShell>
      </section>
    </PageBand>
  );
}
