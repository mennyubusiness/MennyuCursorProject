/**
 * Order age / urgency for the vendor dashboard (New orders, active sections).
 * Centralized thresholds; aligns conceptually with admin exception urgency.
 */

const NEW_MAX_MINUTES = 5;
const AGING_MAX_MINUTES = 15;

export type VendorUrgencyLevel = "new" | "aging" | "urgent";

export interface VendorOrderUrgency {
  level: VendorUrgencyLevel;
  label: string;
  ageMinutes: number;
  ageText: string;
}

/** Human-readable order age: "12m old", "1h 5m old", "44h 20m old". */
export function formatOrderAge(ageMinutes: number): string {
  if (ageMinutes < 60) return `${ageMinutes}m old`;
  const hours = Math.floor(ageMinutes / 60);
  const mins = ageMinutes % 60;
  return mins === 0 ? `${hours}h old` : `${hours}h ${mins}m old`;
}

export function getVendorOrderUrgency(createdAt: Date): VendorOrderUrgency {
  const ageMs = Date.now() - createdAt.getTime();
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  const ageText = formatOrderAge(ageMinutes);

  if (ageMinutes < NEW_MAX_MINUTES) {
    return { level: "new", label: "New", ageMinutes, ageText };
  }
  if (ageMinutes < AGING_MAX_MINUTES) {
    return { level: "aging", label: "Aging", ageMinutes, ageText };
  }
  return { level: "urgent", label: "Urgent", ageMinutes, ageText };
}

/** History entry with fulfillmentStatus and createdAt (e.g. VendorOrderStatusHistory). */
export interface ReadyHistoryEntry {
  fulfillmentStatus?: string | null;
  createdAt: Date;
}

/**
 * Returns minutes since the order entered "ready" state, or null if not ready or no history.
 * Pass statusHistory ordered by createdAt asc; uses the first entry where fulfillmentStatus === "ready".
 */
export function getReadyWaitMinutes(
  statusHistory: ReadyHistoryEntry[] | null | undefined
): number | null {
  if (!statusHistory?.length) return null;
  const readyEntries = statusHistory.filter((e) => e.fulfillmentStatus === "ready");
  if (readyEntries.length === 0) return null;
  const firstReady = readyEntries[0];
  const readyAt = firstReady.createdAt instanceof Date ? firstReady.createdAt : new Date(firstReady.createdAt);
  return Math.floor((Date.now() - readyAt.getTime()) / (60 * 1000));
}

/** Escalation for "ready for pickup" wait time: under 5m neutral, 5–10m yellow, 10+ red. */
export type ReadyWaitEscalation = "neutral" | "yellow" | "red";

export function getReadyWaitEscalation(minutes: number): ReadyWaitEscalation {
  if (minutes < 5) return "neutral";
  if (minutes < 10) return "yellow";
  return "red";
}

/** Escalation for "behind other vendors": 0–5m yellow, 5–10m strong, 10+ red. */
export type BehindSiblingEscalation = "yellow" | "strong" | "red";

export function getBehindSiblingEscalation(minutesSinceFirstSiblingReady: number): BehindSiblingEscalation {
  if (minutesSinceFirstSiblingReady < 5) return "yellow";
  if (minutesSinceFirstSiblingReady < 10) return "strong";
  return "red";
}
