/**
 * Account-owned solo cart persistence: attach, lookup, and sign-in claim.
 * Group-order carts are not treated as account solo carts while a session is active.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { isCartRowAssigned } from "@/lib/cart-pod-context";
import { selectCartForSessionAndPod } from "@/lib/cart-selection";

const ACTIVE_GROUP_SESSION_STATUSES = ["active", "locked_checkout"] as const;

export type AccountCartClaimResult = {
  accountCartId: string | null;
  claimedGuestCart: boolean;
  preservedExistingAccountCart: boolean;
};

type CartRowPick = {
  id: string;
  podId: string;
  sessionId: string;
  userId: string | null;
  updatedAt: Date;
  items: Array<{ id: string }>;
  groupOrderSession?: { status: string } | null;
};

function hasActiveGroupSession(row: CartRowPick): boolean {
  const status = row.groupOrderSession?.status;
  return Boolean(
    status &&
      ACTIVE_GROUP_SESSION_STATUSES.includes(
        status as (typeof ACTIVE_GROUP_SESSION_STATUSES)[number]
      )
  );
}

/** Solo account cart candidate — owned by user, not an active group-order cart. */
export function isAccountSoloCartRow(row: CartRowPick): boolean {
  if (!row.userId) return false;
  return !hasActiveGroupSession(row);
}

/** Guest solo cart in the browser session (never account-owned). */
export function isGuestSoloCartRow(row: CartRowPick): boolean {
  if (row.userId) return false;
  return !hasActiveGroupSession(row);
}

function selectAssignedAccountSoloCart<T extends CartRowPick>(
  rows: T[],
  preferredPodId: string | null
): T | null {
  const solo = rows.filter(isAccountSoloCartRow);
  const assigned = solo.filter((r) =>
    isCartRowAssigned({
      itemCount: r.items.length,
      hasActiveGroupSession: false,
    })
  );
  if (assigned.length === 0) {
    return null;
  }
  return (
    selectCartForSessionAndPod(assigned, preferredPodId) ??
    assigned.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ??
    null
  );
}

function selectAssignedGuestSoloCart<T extends CartRowPick>(
  rows: T[],
  preferredPodId: string | null
): T | null {
  const solo = rows.filter(isGuestSoloCartRow);
  const assigned = solo.filter((r) =>
    isCartRowAssigned({ itemCount: r.items.length, hasActiveGroupSession: false })
  );
  if (assigned.length === 0) return null;
  return (
    selectCartForSessionAndPod(assigned, preferredPodId) ??
    assigned.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ??
    null
  );
}

const ACCOUNT_SOLO_CART_SELECT = {
  id: true,
  podId: true,
  sessionId: true,
  userId: true,
  updatedAt: true,
  items: { select: { id: true } },
  groupOrderSession: { select: { status: true } },
} as const;

/** Active assigned solo cart for a signed-in customer (any pod, prefers preferredPodId). */
export async function findActiveAccountSoloCartId(
  userId: string,
  preferredPodId: string | null = null
): Promise<string | null> {
  const rows = await prisma.cart.findMany({
    where: { userId },
    select: ACCOUNT_SOLO_CART_SELECT,
    orderBy: { updatedAt: "desc" },
  });
  return selectAssignedAccountSoloCart(rows, preferredPodId)?.id ?? null;
}

/** Attach a guest solo cart row to the signed-in account (no merge). */
export async function attachGuestCartToUser(cartId: string, userId: string): Promise<boolean> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      id: true,
      userId: true,
      groupOrderSession: { select: { status: true } },
    },
  });
  if (!cart || cart.userId || hasActiveGroupSession(cart as CartRowPick)) {
    return false;
  }
  await prisma.cart.update({
    where: { id: cartId },
    data: { userId },
  });
  return true;
}

/**
 * On sign-in: restore account cart; claim guest cart only when account has no assigned solo cart.
 * Does not merge when both have items — account wins, guest orphan stays in DB.
 */
export async function resolveAccountCartOwnershipOnSignIn(
  userId: string,
  sessionId: string
): Promise<AccountCartClaimResult> {
  const [accountRows, guestRows] = await Promise.all([
    prisma.cart.findMany({
      where: { userId },
      select: ACCOUNT_SOLO_CART_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cart.findMany({
      where: { sessionId, userId: null },
      select: ACCOUNT_SOLO_CART_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const accountCart = selectAssignedAccountSoloCart(accountRows, null);
  if (accountCart) {
    return {
      accountCartId: accountCart.id,
      claimedGuestCart: false,
      preservedExistingAccountCart: true,
    };
  }

  const guestCart = selectAssignedGuestSoloCart(guestRows, null);
  if (guestCart) {
    const attached = await attachGuestCartToUser(guestCart.id, userId);
    return {
      accountCartId: attached ? guestCart.id : null,
      claimedGuestCart: attached,
      preservedExistingAccountCart: false,
    };
  }

  return {
    accountCartId: null,
    claimedGuestCart: false,
    preservedExistingAccountCart: false,
  };
}

/** Ensure new/continued solo cart rows are linked to the signed-in customer. */
export async function ensureCartOwnedByUser(cartId: string, userId: string): Promise<void> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { id: true, userId: true, groupOrderSession: { select: { status: true } } },
  });
  if (!cart || hasActiveGroupSession(cart as CartRowPick)) return;
  if (cart.userId && cart.userId !== userId) return;
  if (!cart.userId) {
    await prisma.cart.update({ where: { id: cartId }, data: { userId } });
  }
}
