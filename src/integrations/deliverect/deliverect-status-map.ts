/**
 * Strict Deliverect → Mennyu mapping for webhook-driven vendor order state.
 * Only values from explicit allowlists become Mennyu enums; everything else is `unmapped`.
 * @see https://developers.deliverect.com/page/order-status
 */
import type { VendorOrderFulfillmentStatus, VendorOrderRoutingStatus } from "@/domain/types";
import {
  DELIVERECT_STATUS_NAME_TO_CODE,
  coerceDeliverectRawToStatusNumber,
  readDeliverectStatusCodeFromFlat,
} from "@/integrations/deliverect/payload-status-read";

const LOG_PREFIX = "[Deliverect status map]";

/** Numeric codes that map to Mennyu fulfillment + optional routing (strict allowlist). */
export const DELIVERECT_MAPPED_NUMERIC_CODES: ReadonlySet<number> = new Set([
  ...[110, 100, 115],
  ...[120, 121, 124, 125, 35, 126],
  /** Transport / pipeline — fulfillment stays `pending` (customer = Received). */
  ...[0, 1, 2, 3, 4, 5, 6, 7, 10, 25],
  /** POS accepted — only explicit acceptance promotes fulfillment to `accepted`. */
  20,
  40,
  50,
  60,
  70,
  90,
  95,
  89,
]);

export type DeliverectMennyuOperationalMapping = {
  /** Mennyu fulfillment — always from allowlist; never raw Deliverect strings. */
  fulfillmentStatus: VendorOrderFulfillmentStatus;
  /** Present when the code implies a routing change (POS failure, cancel path). */
  routingStatus?: VendorOrderRoutingStatus;
};

export type DeliverectStatusInterpretation =
  | ({
      kind: "mapped";
      rawNumericCode: number | null;
    } & DeliverectMennyuOperationalMapping)
  | {
      kind: "unmapped";
      rawNumericCode: number | null;
      /** Best-effort hint for logs only — not used for state. */
      rawEventHint: string | null;
    };

function interpretNumericCode(code: number): DeliverectStatusInterpretation {
  if ([110, 100, 115].includes(code)) {
    return {
      kind: "mapped",
      fulfillmentStatus: "cancelled",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }
  if ([120, 121, 124, 125, 35, 126].includes(code)) {
    return {
      kind: "mapped",
      fulfillmentStatus: "pending",
      routingStatus: "failed",
      rawNumericCode: code,
    };
  }

  /**
   * Deliverect pipeline / DMA / POS **receipt** — not kitchen acceptance.
   * Parsed, Sent to DMA, Received by DMA, Received by POS, NEW, Scheduled, etc. stay `pending`
   * so customer/vendor UIs remain on “Received” until code 20 (ACCEPTED).
   * @see https://developers.deliverect.com/page/order-status
   */
  if ([0, 1, 2, 3, 4, 5, 6, 7, 10, 25].includes(code)) {
    return {
      kind: "mapped",
      fulfillmentStatus: "pending",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }

  /** Explicit POS / channel acceptance — only this bucket promotes to Confirmed / Accepted. */
  if (code === 20) {
    return {
      kind: "mapped",
      fulfillmentStatus: "accepted",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }
  if (code === 40 || code === 50) {
    return {
      kind: "mapped",
      fulfillmentStatus: "preparing",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }
  if (code === 60 || code === 70) {
    return {
      kind: "mapped",
      fulfillmentStatus: "ready",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }
  if (code === 90 || code === 95 || code === 89) {
    return {
      kind: "mapped",
      fulfillmentStatus: "completed",
      routingStatus: "confirmed",
      rawNumericCode: code,
    };
  }

  console.warn(`${LOG_PREFIX} unmapped numeric status code (no Mennyu mapping)`, {
    code,
  });
  return {
    kind: "unmapped",
    rawNumericCode: code,
    rawEventHint: null,
  };
}

/**
 * If the webhook only provides a string event/name, map only when it matches the same
 * allowlist as numeric name tokens (e.g. ACCEPTED → 20). No fuzzy substring matching.
 */
function interpretStrictStringEvent(eventType: string): DeliverectStatusInterpretation | null {
  const trimmed = eventType.trim();
  if (!trimmed) return null;
  const asNum = coerceDeliverectRawToStatusNumber(trimmed);
  if (asNum != null) return interpretNumericCode(asNum);
  const key = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  const code = DELIVERECT_STATUS_NAME_TO_CODE[key];
  if (code != null) return interpretNumericCode(code);
  return null;
}

/**
 * Single entry: flattened Deliverect payload → mapped Mennyu operational state or unmapped.
 */
export function interpretDeliverectWebhookFlat(
  flat: Record<string, unknown>
): DeliverectStatusInterpretation {
  const code = readDeliverectStatusCodeFromFlat(flat);
  if (code != null) {
    return interpretNumericCode(code);
  }

  const eventType = String(
    flat.eventType ?? flat.type ?? flat.event ?? flat.reason ?? ""
  ).trim();
  if (eventType) {
    const fromString = interpretStrictStringEvent(eventType);
    if (fromString) return fromString;
    console.warn(`${LOG_PREFIX} unmapped string event (not in name allowlist)`, {
      eventType: eventType.slice(0, 200),
    });
  }

  console.warn(`${LOG_PREFIX} unmapped webhook (no numeric code and no mappable string)`, {
    hasEventType: Boolean(eventType),
  });
  return {
    kind: "unmapped",
    rawNumericCode: null,
    rawEventHint: eventType || null,
  };
}

/** @deprecated Use interpretDeliverectWebhookFlat; kept for tests and gradual migration. */
export function mapDeliverectStatusCodeToMennyuUpdate(statusCode: number | null): {
  routingStatus?: VendorOrderRoutingStatus;
  fulfillmentStatus?: VendorOrderFulfillmentStatus;
} {
  if (statusCode == null) return {};
  const i = interpretNumericCode(statusCode);
  if (i.kind !== "mapped") return {};
  return {
    fulfillmentStatus: i.fulfillmentStatus,
    ...(i.routingStatus != null ? { routingStatus: i.routingStatus } : {}),
  };
}
