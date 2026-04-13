/**
 * Group order session layer (MVP): shared cart, host pays, participant attribution on lines.
 * See prisma GroupOrderSession / GroupOrderParticipant.
 */
import { randomBytes, randomInt } from "crypto";
import type { GroupOrderSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CartValidationError } from "@/services/cart-validation-error";
import { normalizePhoneToE164US } from "@/lib/phone-e164";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_JOIN_CODE_ATTEMPTS = 30;

export type GroupOrderActorRole = "host" | "participant";

export type ResolvedGroupCartActor = {
  sessionId: string;
  sessionStatus: GroupOrderSessionStatus;
  cartId: string;
  podId: string;
  participantId: string;
  role: GroupOrderActorRole;
};

async function generateUniqueJoinCode(): Promise<string> {
  for (let i = 0; i < MAX_JOIN_CODE_ATTEMPTS; i++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const taken = await prisma.groupOrderSession.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not allocate join code");
}

function newJoinToken(): string {
  return randomBytes(32).toString("hex");
}

export async function startGroupOrderSession(args: {
  hostUserId: string;
  cartId: string;
  podId: string;
  hostDisplayName: string;
}): Promise<{ sessionId: string; joinCode: string }> {
  const cart = await prisma.cart.findUnique({ where: { id: args.cartId }, select: { id: true, podId: true } });
  if (!cart || cart.podId !== args.podId) {
    throw new Error("CART_POD_MISMATCH");
  }

  const existing = await prisma.groupOrderSession.findUnique({
    where: { cartId: args.cartId },
    select: { id: true, joinCode: true, hostUserId: true, podId: true },
  });
  if (existing) {
    if (existing.hostUserId !== args.hostUserId || existing.podId !== args.podId) {
      throw new Error("GROUP_ORDER_SESSION_EXISTS");
    }
    return { sessionId: existing.id, joinCode: existing.joinCode };
  }

  const joinCode = await generateUniqueJoinCode();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const hostToken = newJoinToken();

  try {
    await prisma.$transaction(async (tx) => {
      const session = await tx.groupOrderSession.create({
        data: {
          joinCode,
          podId: args.podId,
          cartId: args.cartId,
          hostUserId: args.hostUserId,
          status: "active",
          expiresAt,
        },
      });

      const hostParticipant = await tx.groupOrderParticipant.create({
        data: {
          groupOrderSessionId: session.id,
          userId: args.hostUserId,
          role: "host",
          displayName: args.hostDisplayName.slice(0, 120),
          phoneE164: null,
          joinToken: hostToken,
        },
      });

      await tx.cartItem.updateMany({
        where: { cartId: args.cartId },
        data: { groupOrderParticipantId: hostParticipant.id },
      });
    });
  } catch (e) {
    const isUnique = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
    if (!isUnique) throw e;
    const dup = await prisma.groupOrderSession.findUnique({
      where: { cartId: args.cartId },
      select: { id: true, joinCode: true, hostUserId: true, podId: true },
    });
    if (!dup) throw e;
    if (dup.hostUserId !== args.hostUserId || dup.podId !== args.podId) {
      throw new Error("GROUP_ORDER_SESSION_EXISTS");
    }
    return { sessionId: dup.id, joinCode: dup.joinCode };
  }

  const s = await prisma.groupOrderSession.findUnique({
    where: { cartId: args.cartId },
    select: { id: true, joinCode: true },
  });
  if (!s) throw new Error("GROUP_ORDER_CREATE_FAILED");
  return { sessionId: s.id, joinCode: s.joinCode };
}

/** When a joiner has a participant cookie, resolve the shared cart for this pod (if session still active). */
export async function resolveSharedGroupCartIdForPod(
  podId: string,
  joinTokenFromCookie: string | null
): Promise<string | null> {
  const t = joinTokenFromCookie?.trim();
  if (!t) return null;
  const p = await prisma.groupOrderParticipant.findFirst({
    where: {
      joinToken: t,
      leftAt: null,
      role: "participant",
      groupOrderSession: {
        podId,
        status: { in: ["active", "locked_checkout"] },
        expiresAt: { gt: new Date() },
      },
    },
    select: { groupOrderSession: { select: { cartId: true } } },
  });
  return p?.groupOrderSession.cartId ?? null;
}

export async function findSessionByCartId(cartId: string) {
  return prisma.groupOrderSession.findUnique({
    where: { cartId },
    include: {
      participants: { where: { leftAt: null } },
      pod: { select: { id: true, name: true } },
    },
  });
}

export async function findActiveSessionByJoinCode(joinCode: string) {
  const code = joinCode.replace(/\D/g, "").slice(0, 6).padStart(6, "0");
  return prisma.groupOrderSession.findFirst({
    where: {
      joinCode: code,
      status: "active",
      expiresAt: { gt: new Date() },
    },
    include: { pod: { select: { id: true, name: true } } },
  });
}

export async function findSessionByIdForJoin(sessionId: string) {
  return prisma.groupOrderSession.findFirst({
    where: {
      id: sessionId,
      status: "active",
      expiresAt: { gt: new Date() },
    },
    include: { pod: { select: { id: true, name: true } } },
  });
}

export type JoinGroupOrderInput = {
  groupOrderSessionId: string;
  displayName: string;
  phoneRaw: string;
};

export async function joinGroupOrderSession(
  input: JoinGroupOrderInput
): Promise<{ participantId: string; joinToken: string; cartId: string; podId: string }> {
  const phone = normalizePhoneToE164US(input.phoneRaw);
  if (!phone.ok) {
    throw new Error(phone.error);
  }
  const name = input.displayName.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error("Enter a display name (1–120 characters).");
  }

  const session = await prisma.groupOrderSession.findFirst({
    where: {
      id: input.groupOrderSessionId,
      status: "active",
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) {
    throw new Error("This group order is no longer open.");
  }

  const joinToken = newJoinToken();
  const participant = await prisma.groupOrderParticipant.create({
    data: {
      groupOrderSessionId: session.id,
      userId: null,
      role: "participant",
      displayName: name,
      phoneE164: phone.e164,
      joinToken,
    },
  });

  return {
    participantId: participant.id,
    joinToken,
    cartId: session.cartId,
    podId: session.podId,
  };
}

export async function resolveActorForGroupCart(
  cartId: string,
  opts: { hostUserId: string | null; joinTokenFromCookie: string | null }
): Promise<ResolvedGroupCartActor | null> {
  const session = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    include: { participants: true },
  });
  if (!session) return null;
  if (session.status === "ended" || session.status === "expired" || session.status === "submitted") {
    return null;
  }
  if (session.expiresAt <= new Date()) {
    return null;
  }

  if (opts.hostUserId && opts.hostUserId === session.hostUserId) {
    const hostP = session.participants.find((p) => p.role === "host" && !p.leftAt);
    if (!hostP) return null;
    return {
      sessionId: session.id,
      sessionStatus: session.status,
      cartId: session.cartId,
      podId: session.podId,
      participantId: hostP.id,
      role: "host",
    };
  }

  const token = opts.joinTokenFromCookie?.trim();
  if (token) {
    const p = session.participants.find(
      (x) => x.joinToken === token && !x.leftAt && x.role === "participant"
    );
    if (p) {
      return {
        sessionId: session.id,
        sessionStatus: session.status,
        cartId: session.cartId,
        podId: session.podId,
        participantId: p.id,
        role: "participant",
      };
    }
  }

  return null;
}

export function assertGroupCartNotLocked(actor: ResolvedGroupCartActor | null, sessionStatus: GroupOrderSessionStatus) {
  if (sessionStatus === "locked_checkout") {
    throw new CartValidationError(
      "This cart is locked while the host checks out.",
      "GROUP_ORDER_LOCKED"
    );
  }
}

export function assertCanMutateCartItem(args: {
  actor: ResolvedGroupCartActor;
  itemParticipantId: string | null;
}): void {
  if (args.actor.sessionStatus === "locked_checkout") {
    throw new CartValidationError(
      "This cart is locked while the host checks out.",
      "GROUP_ORDER_LOCKED"
    );
  }
  if (args.actor.role === "host") return;
  if (!args.itemParticipantId || args.itemParticipantId !== args.actor.participantId) {
    throw new CartValidationError("You can only edit your own items in this group order.", "GROUP_ORDER_ITEM_NOT_OWNED");
  }
}

export function assertCanAddLine(actor: ResolvedGroupCartActor): void {
  if (actor.sessionStatus === "locked_checkout") {
    throw new CartValidationError(
      "This cart is locked while the host checks out.",
      "GROUP_ORDER_LOCKED"
    );
  }
}

/**
 * Enforces group-order rules for cart mutations. No-op when the cart is not in a group session.
 * @param actor — null when caller is not a recognized host/participant (triggers GROUP_ORDER_AUTH_REQUIRED if session exists).
 */
export async function enforceGroupOrderCartMutation(
  cartId: string,
  actor: ResolvedGroupCartActor | null,
  op: { kind: "add" } | { kind: "mutate"; cartItemId: string }
): Promise<void> {
  const gos = await prisma.groupOrderSession.findUnique({ where: { cartId }, select: { status: true } });
  if (!gos) return;
  if (gos.status === "submitted" || gos.status === "ended" || gos.status === "expired") {
    throw new CartValidationError("This group order is closed.", "GROUP_ORDER_CLOSED");
  }
  if (!actor) {
    throw new CartValidationError("Join this group order to change the cart.", "GROUP_ORDER_AUTH_REQUIRED");
  }
  const full: ResolvedGroupCartActor = { ...actor, sessionStatus: gos.status };
  if (op.kind === "add") {
    assertCanAddLine(full);
    return;
  }
  const row = await prisma.cartItem.findFirst({
    where: { id: op.cartItemId, cartId },
    select: { groupOrderParticipantId: true },
  });
  assertCanMutateCartItem({
    actor: full,
    itemParticipantId: row?.groupOrderParticipantId ?? null,
  });
}

export async function lockGroupOrderSessionForCheckout(cartId: string, hostUserId: string): Promise<void> {
  const s = await prisma.groupOrderSession.findUnique({ where: { cartId } });
  if (!s || s.hostUserId !== hostUserId) return;
  if (s.status !== "active") return;
  await prisma.groupOrderSession.update({
    where: { id: s.id },
    data: { status: "locked_checkout", lockedAt: new Date() },
  });
}

export async function unlockGroupOrderSessionFromCheckout(cartId: string, hostUserId: string): Promise<void> {
  const s = await prisma.groupOrderSession.findUnique({ where: { cartId } });
  if (!s || s.hostUserId !== hostUserId) return;
  if (s.status !== "locked_checkout") return;
  await prisma.groupOrderSession.update({
    where: { id: s.id },
    data: { status: "active", lockedAt: null },
  });
}

export async function leaveGroupOrderAsParticipant(participantId: string): Promise<void> {
  const p = await prisma.groupOrderParticipant.findUnique({
    where: { id: participantId },
    include: { groupOrderSession: true },
  });
  if (!p || p.leftAt || p.role !== "participant") return;

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { groupOrderParticipantId: participantId } }),
    prisma.groupOrderParticipant.update({
      where: { id: participantId },
      data: { leftAt: new Date() },
    }),
  ]);
}

export async function endGroupOrderAsHost(cartId: string, hostUserId: string): Promise<void> {
  const s = await prisma.groupOrderSession.findUnique({ where: { cartId } });
  if (!s || s.hostUserId !== hostUserId) return;

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId } }),
    prisma.groupOrderSession.delete({ where: { id: s.id } }),
  ]);
}

/** Public participant list for host UI — display names only, no phones. */
/** For reorder / system paths that must attribute new lines to the host participant. */
export async function getHostActorForCartIfGroupOrder(cartId: string): Promise<ResolvedGroupCartActor | null> {
  const session = await prisma.groupOrderSession.findUnique({
    where: { cartId },
    include: { participants: true },
  });
  if (!session || session.status === "ended" || session.status === "expired" || session.status === "submitted") {
    return null;
  }
  const hostP = session.participants.find((p) => p.role === "host" && !p.leftAt);
  if (!hostP) return null;
  return {
    sessionId: session.id,
    sessionStatus: session.status,
    cartId: session.cartId,
    podId: session.podId,
    participantId: hostP.id,
    role: "host",
  };
}
