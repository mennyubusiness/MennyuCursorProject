/**
 * Single-line JSON logs for Deliverect order webhooks — easy to grep and correlate with VO / external ids.
 */

export function logDeliverectOrderWebhook(
  event:
    | "verification_failed"
    | "invalid_json"
    | "duplicate_ignored"
    | "match_failed"
    | "webhook_apply_error"
    | "webhook_applied"
    | "webhook_noop_same_status"
    | "webhook_ignored_backward"
    | "unmapped_status_audit_only"
    | "late_webhook_after_manual_recovery"
    | "late_webhook_after_overdue"
    | "late_webhook_after_fallback_episode",
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({
    event,
    scope: "deliverect_order_webhook",
    ...fields,
  });
  if (
    event === "verification_failed" ||
    event === "invalid_json" ||
    event === "match_failed" ||
    event === "webhook_apply_error"
  ) {
    console.warn(line);
  } else {
    console.info(line);
  }
}
