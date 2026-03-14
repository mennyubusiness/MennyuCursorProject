/**
 * Types for cart server action results and inputs.
 * Kept in a separate file so the "use server" module only exports async functions.
 */
import type { Cart } from "@/domain/types";

export type AddToCartResult =
  | { success: true; cart: Cart }
  | { success: false; error: string; code?: string; cartItemId?: string; menuItemId?: string; menuItemName?: string };

export type UpdateCartItemResult =
  | { success: true; cart: Cart }
  | { success: false; error: string; code?: string; cartItemId?: string; menuItemId?: string; menuItemName?: string };

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };
