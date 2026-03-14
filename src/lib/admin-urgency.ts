/**
 * Exception aging / urgency for the Needs Attention queue.
 * Time-based buckets derived from VendorOrder.createdAt (or equivalent).
 */

// TODO: Tune thresholds based on operations. Current buckets: New 0–5 min, Stuck 5–15 min, Critical 15+ min.
const NEW_MAX_MINUTES = 5;
const STUCK_MAX_MINUTES = 15;

export type UrgencyLevel = "new" | "stuck" | "critical";

export interface ExceptionUrgency {
  urgency: UrgencyLevel;
  /** e.g. "New", "Stuck", "Critical" */
  label: string;
  ageMinutes: number;
  /** e.g. "3 min old", "12 min old" */
  ageText: string;
}

export function getExceptionUrgency(createdAt: Date): ExceptionUrgency {
  const ageMs = Date.now() - createdAt.getTime();
  const ageMinutes = Math.floor(ageMs / (60 * 1000));

  if (ageMinutes < NEW_MAX_MINUTES) {
    return {
      urgency: "new",
      label: "New",
      ageMinutes,
      ageText: ageMinutes <= 1 ? "1 min old" : `${ageMinutes} min old`,
    };
  }
  if (ageMinutes < STUCK_MAX_MINUTES) {
    return {
      urgency: "stuck",
      label: "Stuck",
      ageMinutes,
      ageText: `${ageMinutes} min old`,
    };
  }
  return {
    urgency: "critical",
    label: "Critical",
    ageMinutes,
    ageText: `${ageMinutes} min old`,
  };
}
