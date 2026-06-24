import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { parsePodAmenities, parsePodCustomAmenities } from "@/lib/pod-amenities";
import { PodOrderingQrSection } from "@/components/pod/PodOrderingQrSection";
import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
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

  const publicOrigin = await getPublicSiteOrigin();
  const amenities = parsePodAmenities(pod.amenities);
  const customAmenities = parsePodCustomAmenities(pod.customAmenities);

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
      </div>
    </DashboardShell>
  );
}
