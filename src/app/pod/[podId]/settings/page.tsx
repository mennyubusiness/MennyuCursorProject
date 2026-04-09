import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
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
      description: true,
      imageUrl: true,
      accentColor: true,
    },
  });
  if (!pod) notFound();

  const publicOrigin = await getPublicSiteOrigin();

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-600">
          How this pod looks to customers. Manage vendor order and featured flags on{" "}
          <Link href={`/pod/${pod.id}/dashboard`} className="font-medium text-stone-900 underline">
            Overview
          </Link>
          .
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Brand / profile</h2>
        <p className="mt-1 text-sm text-stone-600">
          Name, description, logo, and accent on the public pod page.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          URL slug: <span className="font-mono text-stone-700">{pod.slug}</span> (not editable here)
        </p>
        <div className="mt-4">
          <PodBrandProfileForm
            podId={pod.id}
            initialName={pod.name}
            initialDescription={pod.description}
            initialImageUrl={pod.imageUrl}
            initialAccentColor={pod.accentColor}
          />
        </div>
      </section>

      <PodOrderingQrSection podId={pod.id} podSlug={pod.slug} podName={pod.name} publicOrigin={publicOrigin} />
    </div>
  );
}
