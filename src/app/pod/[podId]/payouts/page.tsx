import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { env } from "@/lib/env";
import { derivePodPayoutConnectStatus } from "@/lib/pod-payout-connect-status";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import {
  isUserDesignatedPodPayoutRecipient,
  syncPodPayoutConnectedAccountStatus,
} from "@/services/pod-payout-connect.service";
import { prisma } from "@/lib/db";
import { PodPayoutsView } from "./PodPayoutsView";

export default async function PodPayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<{ pod_payout_connect?: string; payout_notice?: string }>;
}) {
  const { podId } = await params;
  const sp = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  const connect = sp.pod_payout_connect;
  if (connect === "return" || connect === "refresh") {
    if (userId && (await isUserDesignatedPodPayoutRecipient(userId, podId))) {
      try {
        await syncPodPayoutConnectedAccountStatus(userId);
      } catch (e) {
        console.error("[pod payouts] pod payout Connect sync failed", e);
      }
    }
    if (connect === "refresh") {
      redirect(`/pod/${podId}/payouts?payout_notice=link_expired`);
    }
    redirect(`/pod/${podId}/payouts`);
  }

  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  const recipientUser =
    userId && ctx.payoutSummary
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: {
            podPayoutStripeConnectedAccountId: true,
            podPayoutStripeChargesEnabled: true,
            podPayoutStripePayoutsEnabled: true,
            podPayoutStripeRequirementsCurrentlyDue: true,
          },
        })
      : null;

  const isDesignatedRecipient =
    Boolean(userId) && ctx.payoutContext?.podPayoutRecipientUserId?.trim() === userId;
  const connectStatus =
    isDesignatedRecipient && recipientUser
      ? derivePodPayoutConnectStatus({
          podPayoutStripeConnectedAccountId: recipientUser.podPayoutStripeConnectedAccountId,
          podPayoutStripeChargesEnabled: recipientUser.podPayoutStripeChargesEnabled,
          podPayoutStripePayoutsEnabled: recipientUser.podPayoutStripePayoutsEnabled,
          podPayoutStripeRequirementsCurrentlyDue:
            recipientUser.podPayoutStripeRequirementsCurrentlyDue,
        })
      : null;

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Payouts"
        description="See what your pod has earned from Open Order and manage payout details."
      />

      <div className="mt-8">
        <PodPayoutsView
          podId={podId}
          summary={ctx.payoutSummary}
          podPayoutsEnabled={ctx.payoutContext?.podPayoutsEnabled ?? false}
          isDesignatedRecipient={isDesignatedRecipient}
          stripeConnectConfigured={Boolean(env.STRIPE_SECRET_KEY)}
          connectStatus={connectStatus}
          payoutNotice={sp.payout_notice === "link_expired" ? "link_expired" : null}
        />
      </div>
    </DashboardShell>
  );
}
