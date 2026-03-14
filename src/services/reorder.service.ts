/**
 * Reorder: create a new cart from a past order snapshot.
 * Preserves line items, modifier selections, and notes; validates availability server-side.
 */
import { prisma } from "@/lib/db";
import { getOrCreateCart, getCartById, addCartItem, CartValidationError } from "@/services/cart.service";
import type { Cart } from "@/domain/types";

export interface ReorderSkippedItem {
  name: string;
  reason: string;
}

export interface ReorderResult {
  success: true;
  cart: Cart;
  addedCount: number;
  skipped: ReorderSkippedItem[];
}

export interface ReorderError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Create a new cart from an order snapshot and add all line items that are still available.
 * Modifier selections and item/order notes are preserved. Unavailable items or modifiers are skipped
 * and reported so the user can be informed.
 */
export async function reorderFromOrder(
  orderId: string,
  sessionId: string
): Promise<ReorderResult | ReorderError> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: {
        include: {
          lineItems: {
            include: {
              selections: { select: { modifierOptionId: true, quantity: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return { success: false, error: "Order not found", code: "NOT_FOUND" };
  }

  const cart = await getOrCreateCart(order.podId, sessionId);
  let addedCount = 0;
  const skipped: ReorderSkippedItem[] = [];

  for (const vo of order.vendorOrders) {
    for (const line of vo.lineItems) {
      const selections =
        line.selections && line.selections.length > 0
          ? line.selections.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))
          : undefined;

      try {
        await addCartItem(cart.id, line.menuItemId, line.quantity, line.specialInstructions ?? null, selections);
        addedCount += 1;
      } catch (e) {
        const message = e instanceof CartValidationError ? e.message : e instanceof Error ? e.message : "Unavailable";
        skipped.push({ name: line.name, reason: message });
      }
    }
  }

  const finalCart = await getCartById(cart.id);
  return {
    success: true,
    cart: finalCart ?? cart,
    addedCount,
    skipped,
  };
}
