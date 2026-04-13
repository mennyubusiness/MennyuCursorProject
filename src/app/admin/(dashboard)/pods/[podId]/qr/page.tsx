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
        <p className="text-sm text-stone-500">
          <Link href="/admin/pods" className="hover:underline">
            Pods
          </Link>
          <span className="mx-1">/</span>
          <Link href={`/admin/pods/${pod.id}`} className="hover:underline">
            {pod.name}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-stone-800">QR</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">QR code — {pod.name}</h1>
        <p className="mt-1 text-sm text-stone-600">
          For on-site setup and support. Same link pod owners see in settings.
        </p>
      </div>
      <PodOrderingQrSection podId={pod.id} podSlug={pod.slug} podName={pod.name} publicOrigin={publicOrigin} />
    </div>
  );
}
