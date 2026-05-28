/** Restore keyboard focus to the menu item add control after closing the modifier modal. */
export function restoreCartFocus(menuItemId: string): void {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-cart-focus-menu-item="${CSS.escape(menuItemId)}"]`
    );
    el?.focus({ preventScroll: true });
  });
}
