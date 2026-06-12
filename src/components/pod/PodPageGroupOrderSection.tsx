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
    <PageBand variant="light" className="border-t-0">
      <section id="pod-group-order" className="scroll-mt-36">
        <PageShell className="py-8 sm:py-10">
          <div className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-5 shadow-sm sm:p-6">
            {ctaState.kind === "start" ? (
              <>
                <header className="max-w-2xl">
                  <h2 className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
                    Ordering with friends?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
                    Start a group order so everyone can add from different vendors while one person
                    checks out.
                  </p>
                </header>
                <div className="mt-5 flex flex-wrap gap-3">
                  {session?.user ? (
                    <PodPageStartGroupOrderButton podId={podId} fallbackHref={groupOrderCartUrl} />
                  ) : (
                    <ButtonLink href={groupOrderHref} size="sm">
                      Start group order
                    </ButtonLink>
                  )}
                  <ButtonLink href={joinHref} variant="outline" size="sm">
                    Join with code
                  </ButtonLink>
                </div>
              </>
            ) : ctaState.kind === "host_active" ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-oo-charcoal">Group order started</h2>
                  <p className="mt-1 text-sm text-oo-stone-gray">
                    Open Quick Cart to invite friends or add items.
                  </p>
                </div>
                <PodPageOpenQuickCartButton />
              </div>
            ) : ctaState.kind === "participant_active" ? (
              <div>
                <h2 className="text-lg font-bold text-oo-charcoal">You&apos;re in a group order</h2>
                <p className="mt-1 text-sm text-oo-stone-gray">
                  Add your items before the host checks out.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-oo-charcoal">Host is checking out</h2>
                <p className="mt-1 text-sm text-oo-stone-gray">
                  New changes are paused until checkout finishes.
                </p>
              </div>
            )}
          </div>
        </PageShell>
      </section>
    </PageBand>
  );
}
