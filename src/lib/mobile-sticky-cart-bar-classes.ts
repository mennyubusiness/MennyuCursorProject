/**
 * Mobile sticky bottom cart/checkout bars — opaque warm surface for readability over photos.
 * Avoid translucent `supports-[backdrop-filter]` overrides; readability over blur.
 */
export const mobileStickyCartBarSurfaceClass =
  "border-t border-oo-light-stone bg-oo-warm-white shadow-[0_-4px_20px_rgba(31,31,28,0.12)]";

/** Fixed mobile cart CTA bar (vendor menu, etc.). Hidden from `lg` up via caller. */
export const mobileStickyCartBarFixedClass = [
  mobileStickyCartBarSurfaceClass,
  "fixed inset-x-0 bottom-0 z-40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
].join(" ");
