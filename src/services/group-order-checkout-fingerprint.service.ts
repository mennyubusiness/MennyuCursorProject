/**
 * Deterministic checkout fingerprint for group orders.
 * Server recomputes and compares — never trust client-only snapshots for payment.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/db";

export type GroupCheckoutFingerprintLine = {
  id: string;
  menuItemId: string;
  quantity: number;
  priceCents: number;
  specialInstructions: string | null;
  groupOrderParticipantId: string | null;
  updatedAt: Date;
  selections: Array<{ modifierOptionId: string; quantity: number; updatedAt: Date }>;
};

export type GroupCheckoutFingerprintParts = {
  groupOrderSessionId: string;
  sessionStatus: string;
  cartId: string;
  cartUpdatedAt: Date;
  lines: GroupCheckoutFingerprintLine[];
};

const FIELD_SEP = "\x1f";
const LINE_SEP = "\x1e";

/** Stable payload string before hashing; exported for unit tests. */
export function formatGroupCheckoutFingerprintPayload(parts: GroupCheckoutFingerprintParts): string {
  const sortedLines = [...parts.lines].sort((a, b) => a.id.localeCompare(b.id));
  const lineSegments = sortedLines.map((line) => {
    const selections = [...line.selections]
      .sort((a, b) => a.modifierOptionId.localeCompare(b.modifierOptionId))
      .map(
        (s) =>
          `${s.modifierOptionId}${FIELD_SEP}${s.quantity}${FIELD_SEP}${s.updatedAt.toISOString()}`
      )
      .join(LINE_SEP);
    return [
      line.id,
      line.menuItemId,
      String(line.quantity),
      String(line.priceCents),
      line.specialInstructions ?? "",
      line.groupOrderParticipantId ?? "",
      line.updatedAt.toISOString(),
      selections,
    ].join(FIELD_SEP);
  });

  return [
    "checkout-v1",
    parts.groupOrderSessionId,
    parts.sessionStatus,
    parts.cartId,
    parts.cartUpdatedAt.toISOString(),
    String(sortedLines.length),
    lineSegments.join(LINE_SEP),
  ].join("|");
}

export function hashGroupCheckoutFingerprintPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export async function loadGroupCheckoutFingerprintParts(
  cartId: string
): Promise<GroupCheckoutFingerprintParts | null> {
  const gos = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    select: {
      id: true,
      status: true,
      cart: { select: { id: true, updatedAt: true } },
    },
  });
  if (!gos?.cart) return null;

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      priceCents: true,
      specialInstructions: true,
      groupOrderParticipantId: true,
      updatedAt: true,
      selections: {
        select: { modifierOptionId: true, quantity: true, updatedAt: true },
      },
    },
  });

  return {
    groupOrderSessionId: gos.id,
    sessionStatus: gos.status,
    cartId: gos.cart.id,
    cartUpdatedAt: gos.cart.updatedAt,
    lines: items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      priceCents: item.priceCents,
      specialInstructions: item.specialInstructions,
      groupOrderParticipantId: item.groupOrderParticipantId,
      updatedAt: item.updatedAt,
      selections: item.selections.map((s) => ({
        modifierOptionId: s.modifierOptionId,
        quantity: s.quantity,
        updatedAt: s.updatedAt,
      })),
    })),
  };
}

export async function computeGroupCheckoutFingerprint(cartId: string): Promise<string | null> {
  const parts = await loadGroupCheckoutFingerprintParts(cartId);
  if (!parts) return null;
  return hashGroupCheckoutFingerprintPayload(formatGroupCheckoutFingerprintPayload(parts));
}

export async function groupCheckoutFingerprintsMatch(
  cartId: string,
  expectedFingerprint: string
): Promise<boolean> {
  const current = await computeGroupCheckoutFingerprint(cartId);
  return current === expectedFingerprint.trim();
}
