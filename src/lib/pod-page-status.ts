export type PodOrderingStatusTone = "open" | "limited" | "closed" | "empty";

export type PodOrderingStatus = {
  label: string;
  tone: PodOrderingStatusTone;
  openVendorCount: number;
  totalVendorCount: number;
};

type VendorAvailabilityInput = {
  unavailable: boolean;
};

/**
 * Pod-level ordering ticker from visible vendor cards.
 * `unavailable` means not orderable (hours, pause, setup, etc.) — hidden vendors are excluded upstream.
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

  const openVendorCount = vendors.filter((v) => !v.unavailable).length;

  if (openVendorCount === 0) {
    return {
      label: "Not accepting orders",
      tone: "closed",
      openVendorCount: 0,
      totalVendorCount,
    };
  }

  if (openVendorCount < totalVendorCount) {
    return {
      label: `${openVendorCount} of ${totalVendorCount} vendors open`,
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
    case "empty":
      return "bg-oo-cream text-oo-stone-gray ring-1 ring-oo-light-stone";
  }
}
