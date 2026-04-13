/**
 * Customer-facing pickup labels (ASAP vs scheduled). Safe for client or server.
 * Uses `Intl` with the pod (or default) IANA timezone — distinct from Deliverect `pickupTime`, which is always UTC.
 * - `requestedPickupAt`: customer scheduled pickup from checkout only.
 * - `estimatedReadyAt`: optional POS / Deliverect prep-time estimate; does not mean the customer chose scheduled ordering.
 * Order history uses {@link formatPickupDetailLine} via `getOrdersByCustomerPhone`; keep wording aligned with the order status page.
 */

function formatLocalWhen(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatPickupDetailLine(
  requestedPickupAt: Date | string | null | undefined,
  timeZone: string,
  estimatedReadyAt?: Date | string | null | undefined
): string {
  if (requestedPickupAt != null) {
    const d =
      typeof requestedPickupAt === "string" ? new Date(requestedPickupAt) : requestedPickupAt;
    return `Pickup · Scheduled for ${formatLocalWhen(d, timeZone)}`;
  }
  if (estimatedReadyAt != null) {
    const d = typeof estimatedReadyAt === "string" ? new Date(estimatedReadyAt) : estimatedReadyAt;
    return `Pickup · ASAP · Est. ready ${formatLocalWhen(d, timeZone)}`;
  }
  return "Pickup · ASAP";
}

export function formatPickupSmsFragment(
  requestedPickupAt: Date | string | null | undefined,
  timeZone: string,
  estimatedReadyAt?: Date | string | null | undefined
): string {
  if (requestedPickupAt != null) {
    const d = typeof requestedPickupAt === "string" ? new Date(requestedPickupAt) : requestedPickupAt;
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
    return `Scheduled pickup ${when}`;
  }
  if (estimatedReadyAt != null) {
    const d = typeof estimatedReadyAt === "string" ? new Date(estimatedReadyAt) : estimatedReadyAt;
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
    return `ASAP pickup (est. ready ${when})`;
  }
  return "ASAP pickup";
}
