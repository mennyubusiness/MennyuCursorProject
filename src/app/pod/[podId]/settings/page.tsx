import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { parsePodAmenities, parsePodCustomAmenities } from "@/lib/pod-amenities";
import { PodOrderingQrSection } from "@/components/pod/PodOrderingQrSection";
import Link from "next/link";
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
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Settings</h1>
        <p className="mt-1 text-sm text-oo-stone-gray">
          How this pod looks to customers. Manage vendor order and featured flags on{" "}
          <Link href={`/pod/${pod.id}/dashboard`} className="font-medium text-oo-charcoal underline">
            Overview
          </Link>
          .
        </p>
      </div>

      <section className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Public profile</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Brand, contact, amenities, and pickup details on the customer pod page.
        </p>
        <p className="mt-2 text-xs text-oo-stone-gray">
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
      </section>

      <PodOrderingQrSection podId={pod.id} podSlug={pod.slug} podName={pod.name} publicOrigin={publicOrigin} />
    </div>
  );
}
