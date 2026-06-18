import { auth } from "@/auth";
import { DestinationPodGroupOrderPrompt } from "@/components/pod/destination/DestinationPodGroupOrderPrompt";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { shouldOfferDestinationGroupOrderPrompt } from "@/lib/destination-pod-group-prompt";
import { getPodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";
import type { PodOrderingStatus } from "@/lib/pod-page-status";

type DestinationPodGroupOrderPromptGateProps = {
  podId: string;
  hasVendors: boolean;
  isQrEntry: boolean;
  orderingStatus: PodOrderingStatus;
};

export async function DestinationPodGroupOrderPromptGate({
  podId,
  hasVendors,
  isQrEntry,
  orderingStatus,
}: DestinationPodGroupOrderPromptGateProps) {
  const [session, ctaState] = await Promise.all([auth(), getPodPageGroupOrderCtaState(podId)]);

  const eligible = shouldOfferDestinationGroupOrderPrompt({
    hasVendors,
    isQrEntry,
    ctaStateKind: ctaState.kind,
    orderingTone: orderingStatus.tone,
  });

  if (!eligible) return null;

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  return (
    <DestinationPodGroupOrderPrompt
      podId={podId}
      isAuthenticated={Boolean(session?.user)}
      groupOrderCartUrl={groupOrderCartUrl}
      groupOrderHref={groupOrderHref}
    />
  );
}
