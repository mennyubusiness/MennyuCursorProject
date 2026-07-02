import { notFound } from "next/navigation";

import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import { prisma } from "@/lib/db";
import { parsePodAmenities, parsePodCustomAmenities } from "@/lib/pod-amenities";
import { PodBrandProfileForm } from "./PodBrandProfileForm";
import { PodDeleteSection } from "./PodDeleteSection";

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
      deletedAt: true,
    },
  });
  if (!pod) notFound();

  const activeVendorCount = await prisma.podVendor.count({
    where: { podId: pod.id, isActive: true, vendor: { deletedAt: null, isActive: true } },
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

        <DashboardSection
          id="delete-pod"
          title="Danger zone"
          description="Permanently remove this pod from public ordering and explore."
        >
          <PodDeleteSection
            podId={pod.id}
            podName={pod.name}
            deletedAt={pod.deletedAt}
            activeVendorCount={activeVendorCount}
          />
        </DashboardSection>
      </div>
    </DashboardShell>
  );
}
