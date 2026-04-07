/**
 * Structured logs for Deliverect channel registration / activation webhooks (vendor auto-mapping).
 */

export type DeliverectChannelRegistrationLogEvent =
  | "verification_failed"
  | "invalid_json"
  | "duplicate_ignored"
  | "missing_channel_link_id"
  | "matched"
  | "no_match"
  | "ambiguous"
  | "already_connected"
  | "channel_link_conflict"
  | "apply_error";

export function logDeliverectChannelRegistration(
  event: DeliverectChannelRegistrationLogEvent,
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({
    event,
    scope: "deliverect_channel_registration",
    ...fields,
  });
  if (
    event === "verification_failed" ||
    event === "invalid_json" ||
    event === "missing_channel_link_id" ||
    event === "apply_error"
  ) {
    console.warn(line);
  } else {
    console.info(line);
  }
}
