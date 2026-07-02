/** Admin mode marquee row — reference for matching scroll speed elsewhere. */
export const ADMIN_MARQUEE_ITEM_COUNT = 8;
export const ADMIN_MARQUEE_REFERENCE_LABEL = "ADMIN MODE";
export const ADMIN_MARQUEE_MOBILE_DURATION_S = 60;
export const ADMIN_MARQUEE_DESKTOP_DURATION_S = 48;

/** Rough label width proxy (characters + separator/gap overhead). */
function estimateMarqueeLabelUnits(label: string): number {
  return label.length + 6;
}

/**
 * Scale marquee duration so a wider row scrolls at the same px/s as the admin banner.
 * Admin banner uses fixed 60s / 48s with eight "ADMIN MODE" segments.
 */
export function getMarqueeDurationToMatchAdminBanner(items: string[]): {
  mobileSeconds: number;
  desktopSeconds: number;
} {
  if (items.length === 0) {
    return {
      mobileSeconds: ADMIN_MARQUEE_MOBILE_DURATION_S,
      desktopSeconds: ADMIN_MARQUEE_DESKTOP_DURATION_S,
    };
  }

  const adminRowUnits =
    ADMIN_MARQUEE_ITEM_COUNT * estimateMarqueeLabelUnits(ADMIN_MARQUEE_REFERENCE_LABEL);
  const rowUnits = items.reduce((sum, item) => sum + estimateMarqueeLabelUnits(item), 0);
  const scale = Math.max(rowUnits / adminRowUnits, 1);

  return {
    mobileSeconds: ADMIN_MARQUEE_MOBILE_DURATION_S * scale,
    desktopSeconds: ADMIN_MARQUEE_DESKTOP_DURATION_S * scale,
  };
}
