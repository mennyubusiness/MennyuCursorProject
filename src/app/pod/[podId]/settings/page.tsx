import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { derivePodPayoutConnectStatus } from "@/lib/pod-payout-connect-status";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { parsePodAmenities, parsePodCustomAmenities } from "@/lib/pod-amenities";
import { PodOrderingQrSection } from "@/components/pod/PodOrderingQrSection";
import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import {
  isUserDesignatedPodPayoutRecipient,
  loadPodPayoutRecipientContext,
  syncPodPayoutConnectedAccountStatus,
} from "@/services/pod-payout-connect.service";
import { PodBrandProfileForm } from "./PodBrandProfileForm";
import { PodPayoutSetupCard } from "./PodPayoutSetupCard";

export default async function PodSettingsPage({
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
        console.error("[pod settings] pod payout Connect sync failed", e);
      }
    }
    if (connect === "refresh") {
      redirect(`/pod/${podId}/settings?payout_notice=link_expired#payout-setup`);
    }
    redirect(`/pod/${podId}/settings#payout-setup`);
  }

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      description: true,
      imageUrl: true,
      accentColor: true,
      address: true,
      contactEmail: true,
      ownerContactPhone: true,
      websiteUrl: true,
      instagramUrl: true,
      pickupInstructions: true,
      amenities: true,
      customAmenities: true,
    },
  });
  if (!pod) notFound();

  const [publicOrigin, payoutContext, recipientUser] = await Promise.all([
    getPublicSiteOrigin(),
    loadPodPayoutRecipientContext(podId),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: {
            podPayoutStripeConnectedAccountId: true,
            podPayoutStripeChargesEnabled: true,
            podPayoutStripePayoutsEnabled: true,
            podPayoutStripeRequirementsCurrentlyDue: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const amenities = parsePodAmenities(pod.amenities);
  const customAmenities = parsePodCustomAmenities(pod.customAmenities);
  const isDesignatedRecipient =
    Boolean(userId) &&
    payoutContext?.podPayoutRecipientUserId?.trim() === userId;
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
    <DashboardShell tier="workspace" className="pb-8 pt-4">
      <DashboardPageHeader
        headingLevel={1}
        eyebrow={pod.name}
        title="Pod settings"
        description="Manage how your pod appears on Open Order, update public page details, and access QR signage."
        actions={
          <Link
            href={`/pod/${pod.id}/dashboard`}
            className="inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal transition-colors hover:bg-oo-cream"
          >
            Back to overview
          </Link>
        }
      />

      <div className="mt-8 space-y-8">
        <DashboardSection
          id="profile"
          title="Public page profile"
          description="Brand, location, amenities, and contact details customers see on your public pod page."
        >
          <DashboardCard className="max-w-3xl">
            <p className="text-xs text-oo-stone-gray">
              URL slug: <span className="font-mono text-oo-charcoal">{pod.slug}</span> (not editable here)
            </p>
            <div className="mt-4">
              <PodBrandProfileForm
                podId={pod.id}
                initialName={pod.name}
                initialTagline={pod.tagline}
                initialDescription={pod.description}
                initialImageUrl={pod.imageUrl}
                initialAccentColor={pod.accentColor}
                initialAddress={pod.address}
                initialContactEmail={pod.contactEmail}
                initialContactPhone={pod.ownerContactPhone}
                initialWebsiteUrl={pod.websiteUrl}
                initialInstagramUrl={pod.instagramUrl}
                initialPickupInstructions={pod.pickupInstructions}
                initialAmenities={amenities}
                initialCustomAmenities={customAmenities}
              />
            </div>
          </DashboardCard>
        </DashboardSection>

        <PodOrderingQrSection
          podId={pod.id}
          podSlug={pod.slug}
          podName={pod.name}
          publicOrigin={publicOrigin}
        />

        <DashboardSection
          id="payout-setup"
          title="Payout setup"
          description="Connect your payout account when you are the designated recipient for this pod."
        >
          <div className="max-w-3xl">
            <PodPayoutSetupCard
              podId={pod.id}
              podPayoutsEnabled={payoutContext?.podPayoutsEnabled ?? false}
              isDesignatedRecipient={isDesignatedRecipient}
              stripeConnectConfigured={Boolean(env.STRIPE_SECRET_KEY)}
              connectStatus={connectStatus}
              payoutNotice={sp.payout_notice === "link_expired" ? "link_expired" : null}
            />
          </div>
        </DashboardSection>
      </div>
    </DashboardShell>
  );
}
