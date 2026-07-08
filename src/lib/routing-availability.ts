/**
 * Whether routing retry (Deliverect submission) is available in this environment.
 * Used by admin exception actions to show/hide "Retry routing" and return clear API responses.
 * Reads process.env directly so this module is safe to use from client code (e.g. vendor dashboard);
 * on the client, ROUTING_MODE is undefined and we return false / generic message.
 */
export function isRoutingRetryAvailable(): boolean {
  return process.env.ROUTING_MODE === "deliverect" || process.env.SQUARE_ROUTING_LIVE === "true";
}

export function getRoutingUnavailableReason(): string {
  if (process.env.ROUTING_MODE === "mock" && process.env.SQUARE_ROUTING_LIVE !== "true") {
    return "Routing retry is unavailable because live POS routing is disabled in this environment.";
  }
  return "Routing retry is unavailable because Deliverect/Square live routing is not configured.";
}
