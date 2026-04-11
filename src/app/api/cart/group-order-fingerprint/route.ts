import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE } from "@/lib/group-order-cookies";
import { resolveActorForGroupCart } from "@/services/group-order.service";
import {
  formatCollaborativeCartFingerprint,
  loadCollaborativeCartFingerprintParts,
} from "@/services/group-order-fingerprint.service";
import { isGroupOrderSessionPollableStatus } from "@/lib/collaborative-cart-freshness";

/**
 * GET /api/cart/group-order-fingerprint?cartId=...
 * Tiny JSON for collaborative cart polling: compare fingerprint to skip full `router.refresh()`.
 * Reuses group-order actor resolution (host session or participant join cookie).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cartId = url.searchParams.get("cartId")?.trim();
  if (!cartId) {
    return NextResponse.json({ ok: false as const, error: "Missing cartId" }, { status: 400 });
  }

  const session = await auth();
  const store = await cookies();
  const joinToken = store.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;

  const actor = await resolveActorForGroupCart(cartId, {
    hostUserId: session?.user?.id ?? null,
    joinTokenFromCookie: joinToken,
  });
  if (!actor) {
    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
  }

  if (!isGroupOrderSessionPollableStatus(actor.sessionStatus)) {
    return NextResponse.json({ ok: false as const, error: "Not pollable" }, { status: 404 });
  }

  const parts = await loadCollaborativeCartFingerprintParts(cartId);
  if (!parts) {
    return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
  }

  const fingerprint = formatCollaborativeCartFingerprint(parts);

  return NextResponse.json({
    ok: true as const,
    fingerprint,
    sessionStatus: parts.sessionStatus,
  });
}
