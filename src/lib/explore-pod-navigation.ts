/** Customer-facing pod detail route used by Explore pod cards. */
export function getPodPageHref(podId: string): string {
  const id = podId.trim();
  return `/pod/${id}`;
}
