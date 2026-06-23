/**
 * Verbose add-to-cart trace logging (cart.actions, cart.service, ModifierModal).
 * Off in production; dev/test only when DEBUG_ADD_TO_CART_TRACE=true.
 */
export function isAddToCartTraceEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.DEBUG_ADD_TO_CART_TRACE === "true"
  );
}
