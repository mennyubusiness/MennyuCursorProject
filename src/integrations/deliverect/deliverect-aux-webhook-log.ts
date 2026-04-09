/**
 * Structured JSON logs for Deliverect prep-time and busy-mode webhooks (grep: deliverect_prep_time_webhook, deliverect_busy_mode_webhook).
 */

export function logDeliverectPrepTimeWebhook(
  event:
    | "applied"
    | "duplicate_ignored"
    | "order_not_found"
    | "invalid_pickup_time"
    | "apply_error",
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({
    event,
    scope: "deliverect_prep_time_webhook",
    ...fields,
  });
  if (event === "order_not_found" || event === "invalid_pickup_time" || event === "apply_error") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function logDeliverectBusyModeWebhook(
  event:
    | "applied"
    | "duplicate_ignored"
    | "vendor_not_found"
    | "invalid_status"
    | "apply_error",
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({
    event,
    scope: "deliverect_busy_mode_webhook",
    ...fields,
  });
  if (event === "vendor_not_found" || event === "invalid_status" || event === "apply_error") {
    console.warn(line);
  } else {
    console.info(line);
  }
}
