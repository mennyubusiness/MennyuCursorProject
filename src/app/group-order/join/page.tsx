import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { readGroupOrderParticipantMarkersFromRequest } from "@/lib/group-participant-order-access";
import {
  GROUP_ORDER_JOIN_COPY,
  resolveGroupOrderJoinState,
} from "@/lib/group-order-join-state";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { getPodCustomerPathForPodId } from "@/lib/pod-route-resolve";
import { GroupOrderJoinForm } from "./GroupOrderJoinForm";

function JoinStateShell({
  title,
  children,
  showExplore = true,
}: {
  title: string;
  children: ReactNode;
  showExplore?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
      <div className="mt-2 space-y-2 text-sm text-stone-600">{children}</div>
      {showExplore ? (
        <Link href="/explore" className="mt-6 inline-block text-stone-900 underline">
          {GROUP_ORDER_JOIN_COPY.exploreLink}
        </Link>
      ) : null}
    </div>
  );
}

export default async function GroupOrderJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; session?: string; error?: string }>;
}) {
  const { code, session: sessionId, error } = await searchParams;
  const cookieStore = await cookies();
  const markers = readGroupOrderParticipantMarkersFromRequest(cookieStore);
  const authSession = await auth();

  const state = await resolveGroupOrderJoinState({
    sessionId,
    joinCode: code,
    markers,
    hostUserId: authSession?.user?.id ?? null,
  });

  switch (state.kind) {
    case "host_view":
      redirect("/cart");
    case "already_joined": {
      const podPath = await getPodCustomerPathForPodId(state.podId);
      redirect(podPath);
    }
    case "submitted_with_access":
      redirect(`/order/${state.orderId}`);
    case "can_join":
      return (
        <div className="mx-auto max-w-md px-4 py-12">
          <h1 className="text-xl font-semibold text-stone-900">Join group order</h1>
          <p className="mt-2 text-sm text-stone-600">
            Pod: <span className="font-medium text-stone-800">{state.podName}</span>
          </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {decodeURIComponent(error)}
            </p>
          ) : null}
          <GroupOrderJoinForm groupOrderSessionId={state.sessionId} />
        </div>
      );
    case "locked_checkout":
      return (
        <JoinStateShell title={GROUP_ORDER_JOIN_COPY.lockedTitle}>
          <p>{GROUP_ORDER_JOIN_COPY.lockedBodyNew}</p>
          {state.participantAccess ? (
            <>
              <p>{GROUP_ORDER_JOIN_COPY.lockedBodyExisting}</p>
              <Link
                href={buildPodCustomerPath(state.podSlug)}
                className="mt-4 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
              >
                View group cart
              </Link>
            </>
          ) : (
            <p>{GROUP_ORDER_JOIN_COPY.lockedTryAgain}</p>
          )}
        </JoinStateShell>
      );
    case "submitted_no_access":
      return (
        <JoinStateShell title={GROUP_ORDER_JOIN_COPY.submittedTitle}>
          <p>{GROUP_ORDER_JOIN_COPY.submittedBody}</p>
          <p>{GROUP_ORDER_JOIN_COPY.submittedNoAccess}</p>
        </JoinStateShell>
      );
    case "ended":
      return (
        <JoinStateShell title={GROUP_ORDER_JOIN_COPY.endedTitle}>
          <p>{GROUP_ORDER_JOIN_COPY.endedBody}</p>
        </JoinStateShell>
      );
    case "expired":
      return (
        <JoinStateShell title={GROUP_ORDER_JOIN_COPY.expiredTitle}>
          <p>{GROUP_ORDER_JOIN_COPY.expiredBody}</p>
        </JoinStateShell>
      );
    case "not_found":
    default:
      return (
        <JoinStateShell title={GROUP_ORDER_JOIN_COPY.notFoundTitle}>
          <p>{GROUP_ORDER_JOIN_COPY.notFoundBody}</p>
        </JoinStateShell>
      );
  }
}
