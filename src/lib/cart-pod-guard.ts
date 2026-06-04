import "server-only";

import { prisma } from "@/lib/db";
import { CartValidationError } from "@/services/cart-validation-error";
import { isCartRowAssigned } from "@/lib/cart-pod-context";

const ACTIVE_GROUP_SESSION_STATUSES = ["active", "locked_checkout"] as const;

/** Block adding to a different pod while another cart in the session is assigned. */
export async function assertSessionAllowsAddToCart(
  sessionId: string,
  cartId: string,
  targetPodId: string
): Promise<void> {
  const rows = await prisma.cart.findMany({
    where: { sessionId },
    select: {
      id: true,
      podId: true,
      pod: { select: { name: true } },
      items: { select: { id: true } },
      groupOrderSession: { select: { status: true } },
    },
  });
  const target = rows.find((r) => r.id === cartId);
  if (!target) throw new Error("Cart not found");

  const blocker = rows.find(
    (r) =>
      r.id !== cartId &&
      isCartRowAssigned({
        itemCount: r.items.length,
        hasActiveGroupSession: Boolean(
          r.groupOrderSession &&
            ACTIVE_GROUP_SESSION_STATUSES.includes(
              r.groupOrderSession.status as (typeof ACTIVE_GROUP_SESSION_STATUSES)[number]
            )
        ),
      })
  );
  if (blocker && blocker.podId !== targetPodId) {
    const targetPod = await prisma.pod.findUnique({
      where: { id: targetPodId },
      select: { name: true },
    });
    throw new CartValidationError(
      `Your cart is for ${blocker.pod.name}. Clear it to start an order from ${targetPod?.name ?? "this pod"}.`,
      "CART_POD_MISMATCH"
    );
  }
}
