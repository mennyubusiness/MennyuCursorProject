import { redirect } from "next/navigation";

/** Analytics lives in admin tooling; pod surface stays overview + settings only. */
export default async function PodAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  redirect(`/pod/${podId}/dashboard`);
}
