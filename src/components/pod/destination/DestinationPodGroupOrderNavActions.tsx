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

type DestinationPodGroupOrderNavActionsProps = {
  podId: string;
};

const navNeutralBtn = cn(
  buttonClassName({ variant: "outline", size: "sm" }),
  "shrink-0 whitespace-nowrap !min-h-9 !border-oo-light-stone !bg-oo-warm-white !px-3 shadow-sm hover:!bg-oo-cream"
);

const navBrandBtn = cn(
  buttonClassName({ variant: "outline", size: "sm" }),
  "shrink-0 whitespace-nowrap !min-h-9 !border-brand/30 !bg-brand/5 !px-3 !text-brand shadow-sm hover:!border-brand/50 hover:!bg-brand/10"
);

/** Compact group-order controls for the Destination pod sticky action row. */
export async function DestinationPodGroupOrderNavActions({
  podId,
}: DestinationPodGroupOrderNavActionsProps) {
  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  if (ctaState.kind === "host_active" || ctaState.kind === "participant_active") {
    return (
      <PodPageOpenQuickCartButton
        label="Open group cart"
        variant="secondary"
        size="sm"
        className={navBrandBtn}
      />
    );
  }

  if (ctaState.kind === "locked_checkout") {
    return (
      <span
        className={cn(navNeutralBtn, "inline-flex cursor-default opacity-80")}
        role="status"
      >
        Checkout in progress
      </span>
    );
  }

  return (
    <>
      {session?.user ? (
        <PodPageStartGroupOrderButton
          podId={podId}
          fallbackHref={groupOrderCartUrl}
          size="sm"
          className={navBrandBtn}
        />
      ) : (
        <ButtonLink href={groupOrderHref} variant="outline" size="sm" className={navBrandBtn}>
          Start group order
        </ButtonLink>
      )}
      <PodPageJoinWithCodeButton className={navNeutralBtn} />
    </>
  );
}
