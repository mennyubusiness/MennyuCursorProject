/**
 * Sprint 3 operational health thresholds — centralized for stuck-order / incident detection.
 * Tune here without scattering magic numbers across admin health services.
 */

/** Order pending payment or pending confirmation beyond this window is stuck. */
export const ORDER_PENDING_PAYMENT_STUCK_MINUTES = 10;

/** VendorOrder fulfillment pending after payment success beyond this window. */
export const VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES = 10;

/** VendorOrder accepted/preparing beyond this window is stuck. */
export const VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES = 45;

/** VendorOrder ready beyond this window is stuck. */
export const VENDOR_READY_STUCK_MINUTES = 120;

/** Default lookback for incident lists and derived detection queries. */
export const INCIDENT_LOOKBACK_DAYS = 7;

/** Dashboard / health aggregate windows. */
export const HEALTH_WINDOW_1H_MS = 60 * 60 * 1000;
export const HEALTH_WINDOW_24H_MS = 24 * HEALTH_WINDOW_1H_MS;

/** Max rows scanned for derived vendor/pod incidents (bounded for performance). */
export const DERIVED_INCIDENT_SCAN_LIMIT = 200;
