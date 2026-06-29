import { CurrentPagePodSync } from "@/components/pod/CurrentPagePodProvider";
import { resolvePodBySlugOrId } from "@/lib/pod-route-resolve";
import { notFound } from "next/navigation";

export default async function PodSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ podSlug: string }>;
}) {
  const { podSlug } = await params;
  const pod = await resolvePodBySlugOrId(podSlug);
  if (!pod?.isActive) notFound();

  return (
    <>
      <CurrentPagePodSync
        currentPagePod={{ id: pod.id, slug: pod.slug, name: pod.name }}
      />
      {children}
    </>
  );
}
