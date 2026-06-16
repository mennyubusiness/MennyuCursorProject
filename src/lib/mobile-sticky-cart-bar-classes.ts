/**
 * Mobile sticky bottom cart/checkout bars — opaque warm surface for readability over photos.
 * Avoid translucent `supports-[backdrop-filter]` overrides; readability over blur.
 */
export const mobileSafeAreaBottomPadding = "pb-[max(0.75rem,env(safe-area-inset-bottom))]";

export const mobileStickyCartBarSurfaceClass =
  "border-t border-oo-light-stone bg-oo-warm-white shadow-[0_-4px_20px_rgba(31,31,28,0.12)]";

/** Fixed mobile cart CTA bar (vendor menu, etc.). Hidden from `lg` up via caller. Keep z-40 in sync with Z_MOBILE_BOTTOM_ACTION_BAR. */
export const mobileStickyCartBarFixedClass = [
  mobileStickyCartBarSurfaceClass,
  "fixed inset-x-0 bottom-0 z-40 px-4 pt-3",
  mobileSafeAreaBottomPadding,
].join(" ");

/** Shared fixed bottom action bar shell (checkout, pod CTA, etc.). */
export const mobileBottomActionBarFixedClass = mobileStickyCartBarFixedClass;

export const mobileBottomActionBarInnerClass =
  "mx-auto flex w-full max-w-lg items-center justify-between gap-3";

/** Pad page content so fixed bottom bars do not cover it (mobile only). */
export const mobileBottomActionBarContentPadClass =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0";

/** In-sheet sticky footer (modifier modal, bottom sheet actions). */
export const mobileBottomActionBarInsetClass = [
  mobileStickyCartBarSurfaceClass,
  "shrink-0 px-4 pt-3",
  mobileSafeAreaBottomPadding,
].join(" ");
