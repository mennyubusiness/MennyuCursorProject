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
  primaryVendorId: string | null;
  primaryPodId: string | null;
  vendorSelectHref: string | null;
  podSelectHref: string | null;
  /** Customer-facing menu URL for the primary vendor, when pod + slug are known. */
  vendorPublicPageHref: string | null;
  /** Customer-facing pod page URL for the primary pod, when slug is known. */
  podPublicPageHref: string | null;
  podSettingsHref: string | null;
  podVendorsHref: string | null;
};

export function getHeaderAccountDisplayLabel(accountMenu: HeaderAccountMenu): string {
  return accountMenu.name?.trim() || accountMenu.email.split("@")[0] || "Account";
}

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
