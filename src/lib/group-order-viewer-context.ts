/**
 * Group-order cart visibility and permissions for customer-facing reads/mutations.
 */
import "server-only";

import type { Cart } from "@/domain/types";
import {
  findSessionByCartId,
  type ResolvedGroupCartActor,
} from "@/services/group-order.service";

export type GroupOrderViewerRole = "host" | "participant" | "unknown" | "solo";

export type GroupOrderViewerContext = {
  isGroupOrder: boolean;
  groupOrderSessionId: string | null;
  viewerRole: GroupOrderViewerRole;
  viewerParticipantId: string | null;
  hostParticipantId: string | null;
  hostUserId: string | null;
  canViewAllLines: boolean;
  canEditAllLines: boolean;
  canCheckout: boolean;
  /** Host-only invite code from the active session. */
  joinCode: string | null;
};

/** Host-only checkout for active group orders — never infer host from read paths. */
export function canViewerCheckoutOnCartPage(args: {
  goStateActive: boolean;
  goStateView: "host" | "participant" | "unknown" | undefined;
  viewerCtx: GroupOrderViewerContext | null;
}): boolean {
  // Inactive group state (solo cart, terminal session, or no session) — always eligible for checkout UI.
  if (!args.goStateActive) {
    return true;
  }
  if (args.goStateView !== "host") return false;
  return Boolean(args.viewerCtx?.canCheckout);
}

export function isGroupParticipantCartView(args: {
  goStateActive: boolean;
  goStateView: "host" | "participant" | "unknown" | undefined;
}): boolean {
  return args.goStateActive && args.goStateView === "participant";
}

const SOLO_VIEWER: GroupOrderViewerContext = {
  isGroupOrder: false,
  groupOrderSessionId: null,
  viewerRole: "solo",
  viewerParticipantId: null,
  hostParticipantId: null,
  hostUserId: null,
  canViewAllLines: true,
  canEditAllLines: true,
  canCheckout: true,
  joinCode: null,
};

export async function buildGroupOrderViewerContext(
  cartId: string,
  actor: ResolvedGroupCartActor | null
): Promise<GroupOrderViewerContext> {
  const session = await findSessionByCartId(cartId);
  if (!session) return SOLO_VIEWER;

  if (
    session.status === "ended" ||
    session.status === "expired" ||
    session.status === "submitted"
  ) {
    return SOLO_VIEWER;
  }

  const hostParticipant = session.participants.find((p) => p.role === "host" && !p.leftAt);
  const hostParticipantId = hostParticipant?.id ?? null;

  if (!actor) {
    return {
      isGroupOrder: true,
      groupOrderSessionId: session.id,
      viewerRole: "unknown",
      viewerParticipantId: null,
      hostParticipantId,
      hostUserId: session.hostUserId,
      canViewAllLines: false,
      canEditAllLines: false,
      canCheckout: false,
      joinCode: null,
    };
  }

  if (actor.role === "host") {
    return {
      isGroupOrder: true,
      groupOrderSessionId: session.id,
      viewerRole: "host",
      viewerParticipantId: actor.participantId,
      hostParticipantId,
      hostUserId: session.hostUserId,
      canViewAllLines: true,
      canEditAllLines: true,
      canCheckout: true,
      joinCode: session.joinCode,
    };
  }

  return {
    isGroupOrder: true,
    groupOrderSessionId: session.id,
    viewerRole: "participant",
    viewerParticipantId: actor.participantId,
    hostParticipantId,
    hostUserId: session.hostUserId,
    canViewAllLines: false,
    canEditAllLines: false,
    canCheckout: false,
    joinCode: null,
  };
}

/** True when this line belongs to the current viewer (strict participant id match for joiners). */
export function isGroupCartLineVisibleToViewer(
  lineParticipantId: string | null | undefined,
  ctx: GroupOrderViewerContext
): boolean {
  if (!ctx.isGroupOrder || ctx.viewerRole === "solo") return true;
  if (ctx.canViewAllLines) return true;
  if (ctx.viewerRole === "participant" && ctx.viewerParticipantId) {
    return lineParticipantId === ctx.viewerParticipantId;
  }
  return false;
}

export function filterCartLinesForViewer<T extends { groupOrderParticipantId?: string | null }>(
  items: T[],
  ctx: GroupOrderViewerContext
): T[] {
  if (!ctx.isGroupOrder || ctx.canViewAllLines) return items;
  if (ctx.viewerRole === "participant" && ctx.viewerParticipantId) {
    return items.filter((i) => i.groupOrderParticipantId === ctx.viewerParticipantId);
  }
  return [];
}

/** Rebuild Cart groups/subtotal after line filtering (API + mutation responses). */
export function applyGroupOrderVisibilityToCart(
  cart: Cart,
  ctx: GroupOrderViewerContext,
  lineParticipantByItemId: Map<string, string | null>
): Cart {
  if (!ctx.isGroupOrder || ctx.canViewAllLines) return cart;

  const visibleItems = cart.items.filter((item) =>
    isGroupCartLineVisibleToViewer(lineParticipantByItemId.get(item.id) ?? null, ctx)
  );

  const byVendor = new Map<string, Cart["groups"][number]>();
  let subtotalCents = 0;
  for (const item of visibleItems) {
    const lineTotal = item.priceCents * item.quantity;
    subtotalCents += lineTotal;
    const existing = byVendor.get(item.vendorId);
    if (existing) {
      existing.items.push(item);
      existing.subtotalCents += lineTotal;
    } else {
      const fromGroup = cart.groups.find((g) => g.vendorId === item.vendorId);
      byVendor.set(item.vendorId, {
        vendorId: item.vendorId,
        vendorName: fromGroup?.vendorName ?? "Vendor",
        items: [item],
        subtotalCents: lineTotal,
      });
    }
  }

  return {
    ...cart,
    items: visibleItems,
    groups: Array.from(byVendor.values()),
    subtotalCents,
  };
}
