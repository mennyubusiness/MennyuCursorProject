/** Thrown when add/update cart item fails validation (modifiers, availability, etc.). Callers can return structured JSON. */
export class CartValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: { cartItemId?: string; menuItemId?: string; menuItemName?: string }
  ) {
    super(message);
    this.name = "CartValidationError";
  }
}
