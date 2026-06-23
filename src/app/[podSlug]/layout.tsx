import { CustomerBrowsePodScope } from "@/components/pod/CustomerBrowsePodScope";
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
      <CustomerBrowsePodScope podId={pod.id} />
      {children}
    </>
  );
}
