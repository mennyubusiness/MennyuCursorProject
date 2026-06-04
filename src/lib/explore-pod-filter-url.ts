/** Build Explore URL when scoping vendors to a pod (clear filter control only — not pod card clicks). */
export function buildExplorePodFilterUrl(
  searchParams: URLSearchParams,
  podId: string | null
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (podId?.trim()) {
    params.set("pod", podId.trim());
  } else {
    params.delete("pod");
  }
  const qs = params.toString();
  return qs ? `/explore?${qs}` : "/explore";
}
