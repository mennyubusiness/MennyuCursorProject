/**
 * Types for cart server action results and inputs.
 * Kept in a separate file so the "use server" module only exports async functions.
 */
import type { Cart } from "@/domain/types";

export type AddToCartResult =
  | { success: true; cart: Cart; recoveredCart?: boolean }
  | { success: false; error: string; code?: string; cartItemId?: string; menuItemId?: string; menuItemName?: string };

export type UpdateCartItemResult =
  | { success: true; cart: Cart; recoveredCart?: boolean }
  | {
      success: false;
      error: string;
      code?: string;
      cart?: Cart;
      cartItemId?: string;
      menuItemId?: string;
      menuItemName?: string;
    };

export type RemoveFromCartResult =
  | { success: true; cart: Cart; recoveredCart?: boolean }
  | { success: false; error: string; code?: string; cart?: Cart };

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

export type CartSyncOperationInput =
  | {
      operationId: string;
      type: "setQuantity";
      cartItemId: string;
      quantity: number;
      specialInstructions?: string | null;
    }
  | {
      operationId: string;
      type: "removeLine";
      cartItemId: string;
    }
  | {
      operationId: string;
      type: "addItem";
      menuItemId: string;
      quantity: number;
      specialInstructions?: string | null;
      selections?: CartItemSelectionInput[] | null;
    };

export type CartSyncBatchResult =
  | {
      success: true;
      cart: Cart;
      appliedOperations: Array<{ operationId: string; status: "applied" }>;
      rejectedOperations: Array<{
        operationId: string;
        status: "rejected";
        reason: string;
        code?: string;
      }>;
    }
  | {
      success: false;
      error: string;
      code?: string;
      cart?: Cart;
      appliedOperations: Array<{ operationId: string; status: "applied" }>;
      rejectedOperations: Array<{
        operationId: string;
        status: "rejected";
        reason: string;
        code?: string;
      }>;
    };
