import { renderPodCustomerPage } from "@/lib/pod-customer-page-render";

export default async function PodSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ podSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { podSlug } = await params;
  const sp = await searchParams;
  return renderPodCustomerPage(podSlug, sp);
}
