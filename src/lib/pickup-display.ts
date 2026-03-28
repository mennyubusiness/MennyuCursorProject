/**
 * Customer-facing pickup labels (ASAP vs scheduled). Safe for client or server.
 * Uses `Intl` with the pod (or default) IANA timezone — distinct from Deliverect `pickupTime`, which is always UTC.
 * Order history uses {@link formatPickupDetailLine} via `getOrdersByCustomerPhone`; keep wording aligned with the order status page.
 */

export function formatPickupDetailLine(
  requestedPickupAt: Date | string | null | undefined,
  timeZone: string
): string {
  if (requestedPickupAt == null) {
    return "Pickup · ASAP";
  }
  const d = typeof requestedPickupAt === "string" ? new Date(requestedPickupAt) : requestedPickupAt;
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `Pickup · Scheduled for ${when}`;
}

export function formatPickupSmsFragment(
  requestedPickupAt: Date | string | null | undefined,
  timeZone: string
): string {
  if (requestedPickupAt == null) {
    return "ASAP pickup";
  }
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
