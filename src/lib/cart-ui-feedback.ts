/** Dispatches a lightweight browser event so shell UI (e.g. cart link) can react without coupling to cart state. */
export function dispatchCartItemAdded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mennyu:cart-added"));
}
