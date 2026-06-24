import Link from "next/link";
import { auth } from "@/auth";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { getPodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";
import { ButtonLink, buttonClassName } from "@/components/ui/button";
import { PodPageJoinWithCodeButton } from "@/components/pod/PodPageJoinWithCodeButton";
import {
  PodPageOpenQuickCartButton,
  PodPageStartGroupOrderButton,
} from "@/components/pod/PodPageGroupOrderCtaClient";
import { cn } from "@/lib/cn";

type PodPageHeroActionsProps = {
  podId: string;
  hasVendors: boolean;
  isQrEntry?: boolean;
};

const heroPrimaryCta = cn(
  buttonClassName({ variant: "primary", size: "md" }),
  "min-h-11 shadow-[0_0_20px_rgba(249,115,22,0.35)]"
);

const heroSecondaryCta = cn(
  buttonClassName({ variant: "outline", size: "md" }),
  "min-h-11 border-white/80 bg-oo-warm-white/90 text-oo-charcoal shadow-sm hover:border-oo-warm-white hover:bg-oo-warm-white"
);

export async function PodPageHeroActions({
  podId,
  hasVendors,
  isQrEntry = false,
}: PodPageHeroActionsProps) {
  if (!hasVendors) {
    return (
      <ButtonLink href="/explore" className={heroPrimaryCta}>
        Explore pods
      </ButtonLink>
    );
  }

  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  const browseVendorsCta = (
    <ButtonLink href="#pod-vendors" className={heroPrimaryCta}>
      Browse vendors
    </ButtonLink>
  );

  const joinButton = <PodPageJoinWithCodeButton className={heroSecondaryCta} />;

  if (isQrEntry) {
    return <div className="flex flex-wrap items-center gap-3">{browseVendorsCta}</div>;
  }

  if (ctaState.kind === "host_active") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <PodPageOpenQuickCartButton
          label="Open group cart"
          variant="primary"
          size="md"
          className={heroPrimaryCta}
        />
        {browseVendorsCta}
        {joinButton}
      </div>
    );
  }

  if (ctaState.kind === "participant_active") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <PodPageOpenQuickCartButton
          label="Open group cart"
          variant="primary"
          size="md"
          className={heroPrimaryCta}
        />
        {browseVendorsCta}
        {joinButton}
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
        {browseVendorsCta}
        {joinButton}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {browseVendorsCta}
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
      {joinButton}
    </div>
  );
}
