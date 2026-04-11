/**
 * Lightweight change-detection for collaborative group carts — not a second source of truth for totals/UI.
 * Used by GET /api/cart/group-order-fingerprint to avoid full RSC refresh when nothing changed.
 */
import { prisma } from "@/lib/db";

export type CollaborativeCartFingerprintParts = {
  sessionStatus: string;
  sessionUpdatedAt: Date;
  lockedAt: Date | null;
  cartUpdatedAt: Date;
  maxCartItemUpdatedAt: Date | null;
  maxSelectionUpdatedAt: Date | null;
  activeParticipantCount: number;
  cartLineCount: number;
};

/** Stable string for equality checks; bump prefix if shape changes. */
export function formatCollaborativeCartFingerprint(parts: CollaborativeCartFingerprintParts): string {
  return [
    "v1",
    parts.sessionStatus,
    parts.sessionUpdatedAt.toISOString(),
    parts.lockedAt?.toISOString() ?? "",
    parts.cartUpdatedAt.toISOString(),
    parts.maxCartItemUpdatedAt?.toISOString() ?? "",
    parts.maxSelectionUpdatedAt?.toISOString() ?? "",
    String(parts.activeParticipantCount),
    String(parts.cartLineCount),
  ].join("|");
}

/**
 * Single round-trip batch after caller has authorized host/participant access.
 * Covers: session lock/status, cart touch, line edits, modifier rows, joins/leaves.
 */
export async function loadCollaborativeCartFingerprintParts(
  cartId: string
): Promise<CollaborativeCartFingerprintParts | null> {
  const gos = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    select: {
      status: true,
      updatedAt: true,
      lockedAt: true,
      cart: { select: { updatedAt: true } },
    },
  });
  if (!gos?.cart) return null;

  const [itemAgg, selAgg, activeParticipantCount, cartLineCount] = await Promise.all([
    prisma.cartItem.aggregate({
      where: { cartId },
      _max: { updatedAt: true },
    }),
    prisma.cartItemSelection.aggregate({
      where: { cartItem: { cartId } },
      _max: { updatedAt: true },
    }),
    prisma.groupOrderParticipant.count({
      where: { groupOrderSession: { cartId }, leftAt: null },
    }),
    prisma.cartItem.count({ where: { cartId } }),
  ]);

  return {
    sessionStatus: gos.status,
    sessionUpdatedAt: gos.updatedAt,
    lockedAt: gos.lockedAt,
    cartUpdatedAt: gos.cart.updatedAt,
    maxCartItemUpdatedAt: itemAgg._max.updatedAt ?? null,
    maxSelectionUpdatedAt: selAgg._max.updatedAt ?? null,
    activeParticipantCount,
    cartLineCount,
  };
}
