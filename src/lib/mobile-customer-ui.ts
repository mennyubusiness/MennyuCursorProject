/** Minimum touch target utility class used across customer mobile UI. */
export const MOBILE_MIN_TAP_TARGET_CLASS = "min-h-11";

/** Primary CTA height on mobile (52px). */
export const MOBILE_PRIMARY_CTA_MIN_HEIGHT_CLASS = "min-h-[3.25rem]";

export function formatMobileBottomActionSummary(itemCount: number, subtotalCents: number): string {
  const label = itemCount === 1 ? "1 item" : `${itemCount} items`;
  return `${label} · $${(subtotalCents / 100).toFixed(2)}`;
}

/** Customer ordering paths where mobile nav should stay minimal. */
export function isCustomerOrderingPath(pathname: string): boolean {
  return /^\/(pod|cart|checkout|order)(\/|$)/.test(pathname);
}
