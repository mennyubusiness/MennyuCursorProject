import Link from "next/link";
import { notFound } from "next/navigation";
import { PodOrderingQrSection } from "@/components/pod/PodOrderingQrSection";
import { prisma } from "@/lib/db";
import { getPublicSiteOrigin } from "@/lib/public-site-url";

export default async function AdminPodQrPage({ params }: { params: Promise<{ podId: string }> }) {
  const { podId } = await params;
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true, slug: true },
  });
  if (!pod) notFound();

  const publicOrigin = await getPublicSiteOrigin();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/pods"
          className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Pods
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">QR code — {pod.name}</h1>
        <p className="mt-1 text-sm text-stone-600">
          For on-site setup and support. Same link pod owners see in settings.
        </p>
      </div>
      <PodOrderingQrSection podId={pod.id} podSlug={pod.slug} podName={pod.name} publicOrigin={publicOrigin} />
    </div>
  );
}
