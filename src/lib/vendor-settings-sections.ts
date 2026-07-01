/**
 * Vendor settings route — legacy section ids and redirects to dedicated workspace pages.
 */
export const VENDOR_SETTINGS_SECTION_IDS = [
  "overview",
  "profile",
  "payouts",
  "pos-menu",
  "pod-membership",
  "account",
  "ordering",
] as const;

export type VendorSettingsSectionId = (typeof VENDOR_SETTINGS_SECTION_IDS)[number];

const SECTION_ID_SET = new Set<string>(VENDOR_SETTINGS_SECTION_IDS);

export function resolveVendorSettingsSection(raw: string | null | undefined): VendorSettingsSectionId {
  const trimmed = raw?.trim();
  if (trimmed && SECTION_ID_SET.has(trimmed)) {
    return trimmed as VendorSettingsSectionId;
  }
  return "profile";
}

/** Legacy `/settings?section=…` URLs mapped to the current dedicated pages. */
export function resolveLegacyVendorSettingsRedirect(
  vendorId: string,
  section: string | null | undefined,
  extra?: { access?: string | null; payout_notice?: string | null }
): string | null {
  const id = vendorId.trim();
  const trimmed = section?.trim();

  switch (trimmed) {
    case "payouts": {
      const params = new URLSearchParams();
      if (extra?.payout_notice === "link_expired") params.set("payout_notice", "link_expired");
      const qs = params.toString();
      return qs ? `/vendor/${id}/payouts?${qs}` : `/vendor/${id}/payouts`;
    }
    case "pos-menu":
      return `/vendor/${id}/connect-pos`;
    case "pod-membership": {
      const params = new URLSearchParams();
      if (extra?.access?.trim()) params.set("access", extra.access.trim());
      const qs = params.toString();
      return qs ? `/vendor/${id}/settings?${qs}#pod-invites` : `/vendor/${id}/settings#pod-invites`;
    }
    case "ordering":
      return `/vendor/${id}/hours`;
    case "account":
      return `/vendor/${id}/dashboard`;
    case "overview":
    case "profile":
    default:
      return null;
  }
}

export function vendorSettingsSectionHref(vendorId: string, _section?: VendorSettingsSectionId): string {
  return `/vendor/${vendorId}/settings`;
}
