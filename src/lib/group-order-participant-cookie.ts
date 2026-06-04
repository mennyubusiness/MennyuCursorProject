/**
 * Guest/signed-in group-order participant markers (HttpOnly participant id — not joinToken).
 */
import "server-only";

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { GROUP_ORDER_JOIN_COOKIE_MAX_AGE_SEC } from "@/lib/group-order-cookies";
import { CURRENT_POD_COOKIE, MENNYU_SESSION_MAX_AGE } from "@/lib/session";

/** HttpOnly cookie: Open Order group-order participant row id (cuid). */
export const GROUP_ORDER_PARTICIPANT_ID_COOKIE = "mennyu_go_participant";

/** @deprecated Legacy join auth cookie — migrated to participant id on read. */
export const GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY = "mennyu_go_join";

export type GroupOrderParticipantMarkers = {
  participantId: string | null;
  /** Legacy token value if present before migration. */
  legacyJoinToken: string | null;
};

type CookieStore = Pick<ReadonlyRequestCookies, "get"> | Pick<ResponseCookies, "get">;

export function readGroupOrderParticipantMarkers(store: CookieStore): GroupOrderParticipantMarkers {
  const participantId = store.get(GROUP_ORDER_PARTICIPANT_ID_COOKIE)?.value?.trim() || null;
  const legacyJoinToken = store.get(GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY)?.value?.trim() || null;
  return { participantId, legacyJoinToken };
}

const cookieBase = {
  path: "/" as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setGroupOrderParticipantCookies(
  store: ResponseCookies,
  args: { participantId: string; podId: string }
): void {
  store.set(GROUP_ORDER_PARTICIPANT_ID_COOKIE, args.participantId, {
    ...cookieBase,
    httpOnly: true,
    maxAge: GROUP_ORDER_JOIN_COOKIE_MAX_AGE_SEC,
  });
  store.set(CURRENT_POD_COOKIE, args.podId, {
    ...cookieBase,
    httpOnly: false,
    maxAge: MENNYU_SESSION_MAX_AGE,
  });
  store.delete(GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY);
}

export function clearGroupOrderParticipantCookies(store: ResponseCookies): void {
  store.delete(GROUP_ORDER_PARTICIPANT_ID_COOKIE);
  store.delete(GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY);
}
