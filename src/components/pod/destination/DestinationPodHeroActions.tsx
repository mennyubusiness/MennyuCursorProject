import Link from "next/link";
import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { getPodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";
import { buildDirectionsUrl } from "@/lib/pod-contact-links";
import { ButtonLink, buttonClassName } from "@/components/ui/button";
import { PodPageJoinWithCodeButton } from "@/components/pod/PodPageJoinWithCodeButton";
import {
  PodPageOpenQuickCartButton,
  PodPageStartGroupOrderButton,
} from "@/components/pod/PodPageGroupOrderCtaClient";
import { cn } from "@/lib/cn";

type DestinationPodHeroActionsProps = {
  podId: string;
  hasVendors: boolean;
  address: string | null;
};

const heroPrimaryCta = cn(
  buttonClassName({ variant: "primary", size: "md" }),
  "min-h-11 shadow-[0_0_20px_rgba(249,115,22,0.35)]"
);

const heroSecondaryCta = cn(
  buttonClassName({ variant: "outline", size: "md" }),
  "min-h-11 border-white/80 bg-oo-warm-white/90 text-oo-charcoal shadow-sm hover:border-oo-warm-white hover:bg-oo-warm-white"
);

const heroGhostCta = cn(
  buttonClassName({ variant: "ghost", size: "md" }),
  "min-h-11 text-white/95 hover:bg-white/15 hover:text-white"
);

export async function DestinationPodHeroActions({
  podId,
  hasVendors,
  address,
}: DestinationPodHeroActionsProps) {
  const location = address?.trim();
  const directionsUrl = location ? buildDirectionsUrl(location) : null;

  if (!hasVendors) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/explore" className={heroPrimaryCta}>
          Explore pods
        </ButtonLink>
        {directionsUrl && (
          <ButtonLink
            href={directionsUrl}
            className={heroSecondaryCta}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions
          </ButtonLink>
        )}
      </div>
    );
  }

  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  const startOrderCta = (
    <a href="#pod-vendors" className={heroPrimaryCta}>
      Start order
    </a>
  );

  const directionsCta =
    directionsUrl && (
      <ButtonLink
        href={directionsUrl}
        className={heroGhostCta}
        target="_blank"
        rel="noopener noreferrer"
      >
        Get directions
      </ButtonLink>
    );

  if (ctaState.kind === "host_active" || ctaState.kind === "participant_active") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <PodPageOpenQuickCartButton
          label="Open group cart"
          variant="primary"
          size="md"
          className={heroPrimaryCta}
        />
        {startOrderCta}
        <PodPageJoinWithCodeButton className={heroSecondaryCta} />
        {directionsCta}
      </div>
    );
  }

  if (ctaState.kind === "locked_checkout") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            heroPrimaryCta,
            "inline-flex cursor-default items-center justify-center opacity-90"
          )}
          role="status"
        >
          Host checking out
        </span>
        {startOrderCta}
        <PodPageJoinWithCodeButton className={heroSecondaryCta} />
        {directionsCta}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {startOrderCta}
      {session?.user ? (
        <PodPageStartGroupOrderButton
          podId={podId}
          fallbackHref={groupOrderCartUrl}
          size="md"
          className={heroSecondaryCta}
        />
      ) : (
        <Link href={groupOrderHref} className={heroSecondaryCta}>
          Start group order
        </Link>
      )}
      <PodPageJoinWithCodeButton className={heroSecondaryCta} />
      {directionsCta}
    </div>
  );
}
