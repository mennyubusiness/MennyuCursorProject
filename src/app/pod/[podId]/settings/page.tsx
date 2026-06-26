import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import { prisma } from "@/lib/db";
import { parsePodAmenities, parsePodCustomAmenities } from "@/lib/pod-amenities";
import { arePodOwnerPayoutsConfigured } from "@/lib/pod-owner-payout-visibility";
import { loadPodPayoutRecipientContext } from "@/services/pod-payout-connect.service";
import { PodBrandProfileForm } from "./PodBrandProfileForm";

export default async function PodSettingsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;

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

  const payoutContext = await loadPodPayoutRecipientContext(podId);
  const showPayouts = arePodOwnerPayoutsConfigured({
    podPayoutsEnabled: payoutContext?.podPayoutsEnabled ?? false,
  });

  const amenities = parsePodAmenities(pod.amenities);
  const customAmenities = parsePodCustomAmenities(pod.customAmenities);

  return (
    <DashboardShell tier="workspace" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Pod Profile"
        description="Manage your pod's public identity, location, branding, and contact details."
      />

      <div className="mt-8 space-y-8">
        <DashboardSection
          id="profile"
          title="Pod profile"
          description="Brand, location, amenities, pickup instructions, and contact details customers see on your public pod page."
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

        <p className="text-sm text-oo-stone-gray">
          QR codes, signage, and announcements live on the{" "}
          <Link href={`/pod/${podId}/promote`} className="font-medium text-oo-charcoal underline">
            Promote
          </Link>
          {showPayouts ? (
            <>
              {" "}
              page. Pod share payouts are on the{" "}
              <Link href={`/pod/${podId}/payouts`} className="font-medium text-oo-charcoal underline">
                Payouts
              </Link>{" "}
              page.
            </>
          ) : (
            <> page.</>
          )}
        </p>
      </div>
    </DashboardShell>
  );
}
