/**
 * Group order session layer (MVP): shared cart, host pays, participant attribution on lines.
 * See prisma GroupOrderSession / GroupOrderParticipant.
 */
import { randomBytes, randomInt } from "crypto";
import type { GroupOrderSessionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CartValidationError } from "@/services/cart-validation-error";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import { computeGroupCheckoutFingerprint } from "@/services/group-order-checkout-fingerprint.service";

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

const ACTIVE_GROUP_SESSION_STATUSES: GroupOrderSessionStatus[] = ["active", "locked_checkout"];

export type GroupOrderActorResolveOpts = {
  hostUserId: string | null;
  participantIdFromCookie?: string | null;
  /** @deprecated Legacy HttpOnly join token cookie — prefer participant id. */
  joinTokenFromCookie?: string | null;
};

/** Active group cart for participant markers (cart page — pod cookie optional). */
export async function resolveGroupCartIdFromParticipantMarkers(
  markers: import("@/lib/group-order-participant-cookie").GroupOrderParticipantMarkers
): Promise<string | null> {
  const { resolveActiveGroupParticipantBinding } = await import(
    "@/lib/group-order-participant-resolve"
  );
  const binding = await resolveActiveGroupParticipantBinding(markers);
  return binding?.cartId ?? null;
}

/** Shared cart for this pod when participant markers match the pod. */
export async function resolveSharedGroupCartIdForPod(
  podId: string,
  markers: import("@/lib/group-order-participant-cookie").GroupOrderParticipantMarkers
): Promise<string | null> {
  const { resolveActiveGroupParticipantBinding } = await import(
    "@/lib/group-order-participant-resolve"
  );
  const binding = await resolveActiveGroupParticipantBinding(markers);
  if (!binding || binding.podId !== podId) return null;
  return binding.cartId;
}

/** Active group cart for a pod: participant markers or signed-in host. */
export async function resolveActiveGroupCartIdForPod(
  podId: string,
  opts: {
    markers: import("@/lib/group-order-participant-cookie").GroupOrderParticipantMarkers;
    hostUserId: string | null;
  }
): Promise<string | null> {
  const byParticipant = await resolveSharedGroupCartIdForPod(podId, opts.markers);
  if (byParticipant) return byParticipant;
  const hostId = opts.hostUserId?.trim();
  if (!hostId) return null;
  const session = await prisma.groupOrderSession.findFirst({
    where: {
      podId,
      hostUserId: hostId,
      status: { in: ACTIVE_GROUP_SESSION_STATUSES },
      expiresAt: { gt: new Date() },
    },
    select: { cartId: true },
  });
  return session?.cartId ?? null;
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

/** Join/tracking page: active sessions or submitted orders still on the same session row. */
export async function findSessionByIdForJoinOrTracking(sessionId: string) {
  return prisma.groupOrderSession.findFirst({
    where: { id: sessionId },
    include: { pod: { select: { id: true, name: true } } },
  });
}

export async function findSessionByJoinCodeForJoinOrTracking(joinCode: string) {
  const code = joinCode.replace(/\D/g, "").slice(0, 6).padStart(6, "0");
  return prisma.groupOrderSession.findFirst({
    where: { joinCode: code },
    include: { pod: { select: { id: true, name: true } } },
  });
}

export type JoinGroupOrderInput = {
  groupOrderSessionId: string;
  displayName: string;
  phoneRaw: string;
  participantIdFromCookie?: string | null;
  joinTokenFromCookie?: string | null;
  joinAttemptKey?: string | null;
  userId?: string | null;
};

type JoinParticipantRow = {
  id: string;
  joinToken: string;
  leftAt: Date | null;
};

function isPrismaUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002");
}

function normalizeJoinAttemptKey(raw: string | null | undefined): string | null {
  const key = raw?.trim();
  if (!key || key.length > 64) return null;
  return key;
}

/** Resolve an existing participant for idempotent join (cookie, user, attempt key, then phone). */
export async function findExistingParticipantForJoin(
  groupOrderSessionId: string,
  opts: {
    participantIdFromCookie: string | null;
    joinTokenFromCookie: string | null;
    joinAttemptKey: string | null;
    userId: string | null;
    phoneE164: string;
  }
): Promise<JoinParticipantRow | null> {
  const participantId = opts.participantIdFromCookie?.trim();
  if (participantId) {
    const byId = await prisma.groupOrderParticipant.findFirst({
      where: {
        id: participantId,
        groupOrderSessionId,
        role: "participant",
      },
      select: { id: true, joinToken: true, leftAt: true },
    });
    if (byId) return byId;
  }

  const token = opts.joinTokenFromCookie?.trim();
  if (token) {
    const byToken = await prisma.groupOrderParticipant.findFirst({
      where: {
        joinToken: token,
        groupOrderSessionId,
        role: "participant",
      },
      select: { id: true, joinToken: true, leftAt: true },
    });
    if (byToken) return byToken;
  }

  if (opts.userId) {
    const byUser = await prisma.groupOrderParticipant.findFirst({
      where: {
        groupOrderSessionId,
        userId: opts.userId,
        role: "participant",
      },
      select: { id: true, joinToken: true, leftAt: true },
    });
    if (byUser) return byUser;
  }

  const attemptKey = opts.joinAttemptKey;
  if (attemptKey) {
    const byAttempt = await prisma.groupOrderParticipant.findFirst({
      where: {
        groupOrderSessionId,
        joinAttemptKey: attemptKey,
        role: "participant",
      },
      select: { id: true, joinToken: true, leftAt: true },
    });
    if (byAttempt) return byAttempt;
  }

  return prisma.groupOrderParticipant.findFirst({
    where: {
      groupOrderSessionId,
      phoneE164: opts.phoneE164,
      role: "participant",
    },
    select: { id: true, joinToken: true, leftAt: true },
  });
}

async function resolveParticipantAfterUniqueConflict(
  groupOrderSessionId: string,
  opts: {
    joinAttemptKey: string | null;
    phoneE164: string;
  }
): Promise<JoinParticipantRow | null> {
  if (opts.joinAttemptKey) {
    const byAttempt = await prisma.groupOrderParticipant.findFirst({
      where: {
        groupOrderSessionId,
        joinAttemptKey: opts.joinAttemptKey,
        role: "participant",
      },
      select: { id: true, joinToken: true, leftAt: true },
    });
    if (byAttempt) return byAttempt;
  }

  return prisma.groupOrderParticipant.findFirst({
    where: {
      groupOrderSessionId,
      phoneE164: opts.phoneE164,
      role: "participant",
    },
    select: { id: true, joinToken: true, leftAt: true },
  });
}

async function finalizeParticipantJoin(
  participant: JoinParticipantRow,
  session: { cartId: string; podId: string },
  displayName: string,
  phoneE164: string,
  userId: string | null
): Promise<{ participantId: string; joinToken: string; cartId: string; podId: string }> {
  await prisma.groupOrderParticipant.update({
    where: { id: participant.id },
    data: {
      leftAt: null,
      displayName: displayName.slice(0, 120),
      phoneE164,
      ...(userId ? { userId } : {}),
    },
  });

  return {
    participantId: participant.id,
    joinToken: participant.joinToken,
    cartId: session.cartId,
    podId: session.podId,
  };
}

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

  const joinAttemptKey = normalizeJoinAttemptKey(input.joinAttemptKey);
  const userId = input.userId?.trim() || null;

  const existing = await findExistingParticipantForJoin(session.id, {
    participantIdFromCookie: input.participantIdFromCookie ?? null,
    joinTokenFromCookie: input.joinTokenFromCookie ?? null,
    joinAttemptKey,
    userId,
    phoneE164: phone.e164,
  });
  if (existing) {
    return finalizeParticipantJoin(existing, session, name, phone.e164, userId);
  }

  const joinToken = newJoinToken();
  try {
    const participant = await prisma.groupOrderParticipant.create({
      data: {
        groupOrderSessionId: session.id,
        userId,
        role: "participant",
        displayName: name,
        phoneE164: phone.e164,
        joinAttemptKey,
        joinToken,
      },
    });
    return {
      participantId: participant.id,
      joinToken,
      cartId: session.cartId,
      podId: session.podId,
    };
  } catch (e) {
    if (!isPrismaUniqueViolation(e)) throw e;
    const raced = await resolveParticipantAfterUniqueConflict(session.id, {
      joinAttemptKey,
      phoneE164: phone.e164,
    });
    if (!raced) throw e;
    return finalizeParticipantJoin(raced, session, name, phone.e164, userId);
  }
}

export async function resolveActorForGroupCart(
  cartId: string,
  opts: GroupOrderActorResolveOpts
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

  const actorBase = {
    sessionId: session.id,
    sessionStatus: session.status,
    cartId: session.cartId,
    podId: session.podId,
  };

  if (opts.hostUserId && opts.hostUserId === session.hostUserId) {
    const hostP = session.participants.find((p) => p.role === "host" && !p.leftAt);
    if (!hostP) return null;
    return {
      ...actorBase,
      participantId: hostP.id,
      role: "host",
    };
  }

  const participantId = opts.participantIdFromCookie?.trim();
  if (participantId) {
    const p = session.participants.find(
      (x) => x.id === participantId && !x.leftAt && x.role === "participant"
    );
    if (p) {
      return { ...actorBase, participantId: p.id, role: "participant" };
    }
  }

  const token = opts.joinTokenFromCookie?.trim();
  if (token) {
    const p = session.participants.find(
      (x) => x.joinToken === token && !x.leftAt && x.role === "participant"
    );
    if (p) {
      return { ...actorBase, participantId: p.id, role: "participant" };
    }
  }

  const uid = opts.hostUserId?.trim();
  if (uid) {
    const p = session.participants.find(
      (x) => x.userId === uid && !x.leftAt && x.role === "participant"
    );
    if (p) {
      return { ...actorBase, participantId: p.id, role: "participant" };
    }
  }

  return null;
}

export function groupOrderLockedForCheckoutMessage(role: GroupOrderActorRole): string {
  return role === "host"
    ? "Checkout is in progress. Return to cart to make changes."
    : "The host is checking out. The group cart is locked.";
}

export function assertGroupCartNotLocked(actor: ResolvedGroupCartActor | null, sessionStatus: GroupOrderSessionStatus) {
  if (sessionStatus === "locked_checkout") {
    const role = actor?.role ?? "participant";
    throw new CartValidationError(
      groupOrderLockedForCheckoutMessage(role),
      "GROUP_ORDER_LOCKED_FOR_CHECKOUT"
    );
  }
}

/** Re-check lock inside cart write transactions (closes pre-lock in-flight mutation races). */
export async function assertGroupCartUnlockedForMutation(
  tx: Prisma.TransactionClient,
  cartId: string,
  actor: ResolvedGroupCartActor | null
): Promise<void> {
  const gos = await tx.groupOrderSession.findUnique({
    where: { cartId },
    select: { status: true },
  });
  if (!gos || gos.status !== "locked_checkout") return;
  const role = actor?.role ?? "participant";
  throw new CartValidationError(
    groupOrderLockedForCheckoutMessage(role),
    "GROUP_ORDER_LOCKED_FOR_CHECKOUT"
  );
}

export function assertCanMutateCartItem(args: {
  actor: ResolvedGroupCartActor;
  itemParticipantId: string | null;
}): void {
  if (args.actor.sessionStatus === "locked_checkout") {
    throw new CartValidationError(
      groupOrderLockedForCheckoutMessage(args.actor.role),
      "GROUP_ORDER_LOCKED_FOR_CHECKOUT"
    );
  }
  if (args.actor.role === "host") return;
  if (!args.itemParticipantId || args.itemParticipantId !== args.actor.participantId) {
    throw new CartValidationError(
      "You can only change your own items in this group order.",
      "GROUP_ORDER_ITEM_NOT_OWNED"
    );
  }
}

export function assertCanAddLine(actor: ResolvedGroupCartActor): void {
  if (actor.sessionStatus === "locked_checkout") {
    throw new CartValidationError(
      groupOrderLockedForCheckoutMessage(actor.role),
      "GROUP_ORDER_LOCKED_FOR_CHECKOUT"
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

export type PrepareGroupOrderCheckoutResult =
  | { ok: true; checkoutFingerprint: string; sessionId: string }
  | { ok: false; code: string; message: string };

const GROUP_CHECKOUT_BLOCKED_STATUSES: GroupOrderSessionStatus[] = ["submitted", "ended", "expired"];

/**
 * Lock group cart for host checkout and return a server-derived cart fingerprint snapshot.
 * Idempotent for the same host when already locked_checkout (refreshes fingerprint).
 */
export async function prepareGroupOrderCheckoutForHost(
  cartId: string,
  hostUserId: string
): Promise<PrepareGroupOrderCheckoutResult> {
  const lockResult = await prisma.$transaction(async (tx) => {
    const s = await tx.groupOrderSession.findUnique({ where: { cartId } });
    if (!s) {
      return { ok: false as const, code: "NOT_GROUP_ORDER", message: "This cart is not a group order." };
    }
    if (s.hostUserId !== hostUserId) {
      return {
        ok: false as const,
        code: "GROUP_ORDER_HOST_CHECKOUT",
        message: "Only the host can check out a group order.",
      };
    }
    if (GROUP_CHECKOUT_BLOCKED_STATUSES.includes(s.status)) {
      return {
        ok: false as const,
        code: "GROUP_ORDER_CLOSED",
        message: "This group order is closed.",
      };
    }
    if (s.expiresAt <= new Date()) {
      return {
        ok: false as const,
        code: "GROUP_ORDER_CLOSED",
        message: "This group order has expired.",
      };
    }
    if (s.status === "active") {
      await tx.groupOrderSession.update({
        where: { id: s.id },
        data: { status: "locked_checkout", lockedAt: new Date() },
      });
    } else if (s.status !== "locked_checkout") {
      return {
        ok: false as const,
        code: "GROUP_ORDER_CLOSED",
        message: "This group order is not open for checkout.",
      };
    }
    return { ok: true as const, sessionId: s.id };
  });

  if (!lockResult.ok) return lockResult;

  const checkoutFingerprint = await computeGroupCheckoutFingerprint(cartId);
  if (!checkoutFingerprint) {
    return {
      ok: false,
      code: "GROUP_CHECKOUT_FINGERPRINT_FAILED",
      message: "Could not capture group cart for checkout. Refresh and try again.",
    };
  }

  return { ok: true, checkoutFingerprint, sessionId: lockResult.sessionId };
}

/** @deprecated Prefer prepareGroupOrderCheckoutForHost (returns fingerprint snapshot). */
export async function lockGroupOrderSessionForCheckout(cartId: string, hostUserId: string): Promise<void> {
  await prepareGroupOrderCheckoutForHost(cartId, hostUserId);
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
