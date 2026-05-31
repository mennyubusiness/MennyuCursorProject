/** Client-safe account menu payload for the site header dropdown. */

export type HeaderAccountMenu = {
  email: string;
  name: string | null;
  roleHint: string | null;
  adminDashboardHref: string | null;
  vendorDashboardHref: string | null;
  vendorDashboardLabel: string | null;
  podDashboardHref: string | null;
  podDashboardLabel: string | null;
};

export function buildHeaderAccountRoleHint(input: {
  isPlatformAdmin: boolean;
  vendorCount: number;
  podCount: number;
}): string | null {
  const parts: string[] = [];
  if (input.isPlatformAdmin) parts.push("Platform admin");
  if (input.vendorCount > 0) parts.push("Vendor");
  if (input.podCount > 0) parts.push("Pod");
  if (parts.length === 0) return null;
  return parts.join(" · ");
}
