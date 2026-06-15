/**
 * Vendor settings workspace — section ids, routing, and sidebar status badges.
 */
export const VENDOR_SETTINGS_SECTION_IDS = [
  "overview",
  "profile",
  "payouts",
  "pos-menu",
  "ordering",
  "pod-membership",
  "account",
] as const;

export type VendorSettingsSectionId = (typeof VENDOR_SETTINGS_SECTION_IDS)[number];

export type VendorSettingsSectionDef = {
  id: VendorSettingsSectionId;
  label: string;
  subtitle: string;
};

export const VENDOR_SETTINGS_SECTIONS: VendorSettingsSectionDef[] = [
  { id: "overview", label: "Overview", subtitle: "Setup status and next steps" },
  { id: "profile", label: "Profile", subtitle: "Customer-facing business details" },
  { id: "payouts", label: "Payouts", subtitle: "Stripe payouts and payment readiness" },
  { id: "pos-menu", label: "POS & menu", subtitle: "Deliverect, menu imports, and mapping health" },
  { id: "ordering", label: "Ordering", subtitle: "Pause or resume Open Order intake" },
  { id: "pod-membership", label: "Pod membership", subtitle: "Pod invitations and activity" },
  { id: "account", label: "Account", subtitle: "Login and dashboard access" },
];

const SECTION_ID_SET = new Set<string>(VENDOR_SETTINGS_SECTION_IDS);

export function resolveVendorSettingsSection(raw: string | null | undefined): VendorSettingsSectionId {
  const trimmed = raw?.trim();
  if (trimmed && SECTION_ID_SET.has(trimmed)) {
    return trimmed as VendorSettingsSectionId;
  }
  return "overview";
}

export function vendorSettingsSectionHref(vendorId: string, section: VendorSettingsSectionId): string {
  const base = `/vendor/${vendorId}/settings`;
  if (section === "overview") return base;
  return `${base}?section=${section}`;
}

export type VendorSettingsSectionBadges = Partial<Record<VendorSettingsSectionId, string>>;

export type VendorSettingsBadgeInput = {
  setupSummary: {
    profile: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
  };
  ordersPaused: boolean;
  pendingPodInviteCount: number;
  hasPodMembership: boolean;
};

export function buildVendorSettingsSectionBadges(input: VendorSettingsBadgeInput): VendorSettingsSectionBadges {
  const { setupSummary, ordersPaused, pendingPodInviteCount, hasPodMembership } = input;

  let posMenuBadge = "Needs setup";
  if (setupSummary.pos && setupSummary.menu) {
    posMenuBadge = "Connected";
  } else if (setupSummary.pos && !setupSummary.menu) {
    posMenuBadge = "Needs menu";
  } else if (setupSummary.pos) {
    posMenuBadge = "Connected";
  }

  let podBadge = "No pod";
  if (pendingPodInviteCount > 0) {
    podBadge = "Invite pending";
  } else if (hasPodMembership) {
    podBadge = "Linked";
  }

  return {
    profile: setupSummary.profile ? "Complete" : "Needs setup",
    payouts: setupSummary.stripe ? "Connected" : "Needs setup",
    "pos-menu": posMenuBadge,
    ordering: ordersPaused ? "Paused" : "Open",
    "pod-membership": podBadge,
  };
}

export function vendorSettingsSectionHeader(section: VendorSettingsSectionId): { title: string; description: string } {
  const def = VENDOR_SETTINGS_SECTIONS.find((s) => s.id === section);
  return {
    title: def?.label ?? "Settings",
    description: def?.subtitle ?? "",
  };
}
