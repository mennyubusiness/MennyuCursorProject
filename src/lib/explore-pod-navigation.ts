/** Customer-facing pod detail route used by Explore pod cards. */
export function getPodPageHref(podSlug: string): string {
  const slug = podSlug.trim();
  return `/${slug}`;
}
