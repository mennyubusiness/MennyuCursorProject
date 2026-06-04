/** Cookie max-age for group-order participant marker (aligned with session TTL). */
export const GROUP_ORDER_JOIN_COOKIE_MAX_AGE_SEC = 60 * 60 * 24; // 24h

export {
  GROUP_ORDER_PARTICIPANT_ID_COOKIE,
  GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY as GROUP_ORDER_JOIN_TOKEN_COOKIE,
  readGroupOrderParticipantMarkers,
  setGroupOrderParticipantCookies,
  clearGroupOrderParticipantCookies,
} from "@/lib/group-order-participant-cookie";
