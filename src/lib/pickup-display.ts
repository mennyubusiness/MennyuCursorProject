/**
 * Single source of truth for customer-facing pickup / ETA display (order status page, history, SMS).
 * Uses explicit IANA timezone from the order (`resolvedPickupTimezone`); does not use the host environment zone.
 *
 * Rule: scheduled checkout time wins; else Deliverect POS estimate; else ASAP with no wall-clock time.
 * Storage and Deliverect parsing are unchanged — display-only.
 */

function coerceInstant(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Minimal order fields for display (unified status API, history mapper, SMS). */
export type OrderPickupDisplayInput = {
  requestedPickupAt?: Date | string | null;
  deliverectEstimatedReadyAt?: Date | string | null;
  resolvedPickupTimezone: string;
};

export type DisplayPickupMode = "scheduled" | "estimated_ready" | "asap";

export type DisplayPickupTimeResult = {
  mode: DisplayPickupMode;
  /** Instant to show in `timeZone`; null only when mode is `asap`. */
  instant: Date | null;
  timeZone: string;
};

/**
 * Which single instant (if any) to show the customer, and in which IANA timezone to format it.
 */
export function getDisplayPickupTime(order: OrderPickupDisplayInput): DisplayPickupTimeResult {
  const timeZone = order.resolvedPickupTimezone;
  const scheduled = coerceInstant(order.requestedPickupAt);
  if (scheduled != null) {
    return { mode: "scheduled", instant: scheduled, timeZone };
  }
  const eta = coerceInstant(order.deliverectEstimatedReadyAt);
  if (eta != null) {
    return { mode: "estimated_ready", instant: eta, timeZone };
  }
  return { mode: "asap", instant: null, timeZone };
}

function formatLocalWhenDetail(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatLocalWhenSms(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * One-line label for order cards and order status header (`Pickup · …`).
 */
export function formatPickupDetailLine(order: OrderPickupDisplayInput): string {
  const r = getDisplayPickupTime(order);
  if (r.mode === "scheduled" && r.instant) {
    return `Pickup · Scheduled for ${formatLocalWhenDetail(r.instant, r.timeZone)}`;
  }
  if (r.mode === "estimated_ready" && r.instant) {
    return `Pickup · ASAP · Est. ready ${formatLocalWhenDetail(r.instant, r.timeZone)}`;
  }
  return "Pickup · ASAP";
}

/**
 * Compact fragment for SMS (no `Pickup ·` prefix).
 */
export function formatPickupSmsFragment(order: OrderPickupDisplayInput): string {
  const r = getDisplayPickupTime(order);
  if (r.mode === "scheduled" && r.instant) {
    return `Scheduled pickup ${formatLocalWhenSms(r.instant, r.timeZone)}`;
  }
  if (r.mode === "estimated_ready" && r.instant) {
    return `ASAP pickup (est. ready ${formatLocalWhenSms(r.instant, r.timeZone)})`;
  }
  return "ASAP pickup";
}

/**
 * Prose lead for order summary (scheduled orders only) — same instant/timezone as {@link formatPickupDetailLine}.
 */
export function formatPickupSummaryScheduledLead(order: OrderPickupDisplayInput): string | null {
  const r = getDisplayPickupTime(order);
  if (r.mode !== "scheduled" || !r.instant) return null;
  return `Your pickup is scheduled for ${formatLocalWhenDetail(r.instant, r.timeZone)}.`;
}

/**
 * Timeline / “Recent updates” row times on the order status page.
 * Uses the same IANA zone as pickup ETA ({@link formatPickupDetailLine}) so header and timeline agree.
 */
export function formatOrderStatusTimelineClock(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
