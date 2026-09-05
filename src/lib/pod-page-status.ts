import { POD_MENU_ONLY_STATUS } from "@/lib/vendor-ordering-mode";

export type PodOrderingStatusTone = "open" | "limited" | "closed" | "empty" | "menu_only";

export type PodOrderingStatus = {
  label: string;
  tone: PodOrderingStatusTone;
  openVendorCount: number;
  totalVendorCount: number;
};

type VendorAvailabilityInput = {
  unavailable: boolean;
  /** Vendor (or its pod) is menu-only by configuration — browsable, never orderable. */
  menuOnly?: boolean;
};

/**
 * Pod-level ordering ticker from visible vendor cards.
 *
 * `unavailable` means an orderable-intent vendor cannot take orders right now (hours, pause,
 * setup). Menu-only vendors are excluded from both counts: they are neither open nor broken,
 * so a pod of only menu-only vendors reads as a browsing destination rather than a closed one.
 * Hidden vendors are excluded upstream.
 */
export function getPodOrderingStatus(vendors: VendorAvailabilityInput[]): PodOrderingStatus {
  const totalVendorCount = vendors.length;
  if (totalVendorCount === 0) {
    return {
      label: "No vendors listed",
      tone: "empty",
      openVendorCount: 0,
      totalVendorCount: 0,
    };
  }

  const orderingVendors = vendors.filter((v) => !v.menuOnly);

  if (orderingVendors.length === 0) {
    return {
      label: POD_MENU_ONLY_STATUS,
      tone: "menu_only",
      openVendorCount: 0,
      totalVendorCount,
    };
  }

  const openVendorCount = orderingVendors.filter((v) => !v.unavailable).length;

  if (openVendorCount === 0) {
    return {
      label: "Not accepting orders",
      tone: "closed",
      openVendorCount: 0,
      totalVendorCount,
    };
  }

  if (openVendorCount < orderingVendors.length) {
    return {
      label: `${openVendorCount} of ${orderingVendors.length} vendors open`,
      tone: "limited",
      openVendorCount,
      totalVendorCount,
    };
  }

  return {
    label: "Open for orders",
    tone: "open",
    openVendorCount,
    totalVendorCount,
  };
}

export function podOrderingStatusBadgeClass(tone: PodOrderingStatusTone): string {
  switch (tone) {
    case "open":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "limited":
      return "bg-amber-50 text-amber-950 ring-1 ring-amber-200";
    case "closed":
      return "bg-oo-cream text-oo-charcoal ring-1 ring-oo-light-stone";
    case "menu_only":
      return "bg-oo-cream text-oo-charcoal ring-1 ring-oo-light-stone";
    case "empty":
      return "bg-oo-cream text-oo-stone-gray ring-1 ring-oo-light-stone";
  }
}
