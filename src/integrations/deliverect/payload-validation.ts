/**
 * Pre-submit validation for built Deliverect order payloads.
 * Deterministic checks only — does not replace Deliverect/POS validation.
 *
 * For proactive mapping issues before checkout, see {@link evaluateDeliverectMenuIntegrityForVendor}.
 */
import { DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH } from "@/lib/deliverect-subitem-nesting";
import {
  deliverectRestaurantFacingPaymentCents,
  vendorOrderItemSubtotalCents,
} from "./deliverect-financial-scope";
import type { DeliverectModifier, DeliverectOrderItem, DeliverectOrderRequest, DeliverectOrderSubLine } from "./payloads";
import type { HydratedVendorOrder } from "./load";

/** Cents tolerance for comparing computed totals vs stored vendor-order money. */
export const DELIVERECT_PAYLOAD_MONEY_TOLERANCE_CENTS = 2;

export type DeliverectPayloadValidationErrorType =
  | "missing_field"
  | "empty_items"
  | "invalid_quantity"
  | "invalid_price"
  | "invalid_modifier"
  | "invalid_nesting"
  | "missing_external_product_id"
  | "price_mismatch"
  | "line_item_count_mismatch"
  | "invalid_payment";

export type DeliverectPayloadValidationSeverity = "error" | "warning";

export interface DeliverectPayloadValidationError {
  type: DeliverectPayloadValidationErrorType;
  message: string;
  /** JSON-pointer-style path, e.g. items[0].subItems[1].modifiers[2] */
  path: string;
  severity: DeliverectPayloadValidationSeverity;
}

export interface DeliverectPayloadValidationResult {
  isValid: boolean;
  errors: DeliverectPayloadValidationError[];
}

export interface DeliverectPayloadValidationSnapshot {
  validatedAt: string;
  isValid: false;
  summary: string;
  errors: DeliverectPayloadValidationError[];
}

function err(
  type: DeliverectPayloadValidationErrorType,
  message: string,
  path: string,
  severity: DeliverectPayloadValidationSeverity = "error"
): DeliverectPayloadValidationError {
  return { type, message, path, severity };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIntegerCents(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && Math.round(v) === v;
}

function isPositiveIntQty(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 1 && Math.round(v) === v;
}

function modifierContribution(m: DeliverectModifier): number {
  const self = m.quantity * m.price;
  const nested = (m.nestedModifiers ?? []).reduce((s, n) => s + modifierContribution(n), 0);
  return self + nested;
}

/** Extended line total in cents (qty × unit price + modifiers + nested sublines). */
function subLineExtendedCents(s: DeliverectOrderSubLine): number {
  const self = s.quantity * s.price;
  const mods = (s.modifiers ?? []).reduce((acc, m) => acc + modifierContribution(m), 0);
  const subs = (s.subItems ?? []).reduce((acc, sub) => acc + subLineExtendedCents(sub), 0);
  return self + mods + subs;
}

function itemExtendedCents(item: DeliverectOrderItem): number {
  const base = item.quantity * item.price;
  const mods = (item.modifiers ?? []).reduce((acc, m) => acc + modifierContribution(m), 0);
  const subs = (item.subItems ?? []).reduce((acc, s) => acc + subLineExtendedCents(s), 0);
  return base + mods + subs;
}

/** Deepest `subItems` chain from this subline (1 = direct child only). */
function subItemChainDepth(s: DeliverectOrderSubLine): number {
  if (!s.subItems?.length) return 0;
  return 1 + Math.max(...s.subItems.map(subItemChainDepth));
}

function validateSubLine(
  s: DeliverectOrderSubLine,
  path: string,
  errors: DeliverectPayloadValidationError[]
): void {
  if (!isNonEmptyString(s.plu)) {
    errors.push(err("missing_field", "Subline must have a non-empty plu", `${path}.plu`));
  }
  if (!isNonEmptyString(s.name)) {
    errors.push(err("missing_field", "Subline must have a non-empty name", `${path}.name`));
  }
  if (!isPositiveIntQty(s.quantity)) {
    errors.push(
      err("invalid_quantity", "Subline quantity must be a positive integer", `${path}.quantity`)
    );
  }
  if (!isIntegerCents(s.price) || s.price < 0) {
    errors.push(err("invalid_price", "Subline price must be a non-negative integer (cents)", `${path}.price`));
  }
  const depth = subItemChainDepth(s);
  if (depth > DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH) {
    errors.push(
      err(
        "invalid_nesting",
        `subItems chain depth exceeds Deliverect maximum for online orders (${DELIVERECT_MAX_SUBITEMS_NESTING_DEPTH} levels)`,
        path
      )
    );
  }
  (s.subItems ?? []).forEach((child, i) => {
    validateSubLine(child, `${path}.subItems[${i}]`, errors);
  });
  (s.modifiers ?? []).forEach((m, i) => {
    validateModifier(m, `${path}.modifiers[${i}]`, errors, 0);
  });
}

const MAX_MODIFIER_NEST = 12;

function validateModifier(
  m: DeliverectModifier,
  path: string,
  errors: DeliverectPayloadValidationError[],
  nestDepth: number
): void {
  if (nestDepth > MAX_MODIFIER_NEST) {
    errors.push(err("invalid_modifier", "Modifier nesting too deep or cyclic", path));
    return;
  }
  if (!isNonEmptyString(m.plu)) {
    errors.push(err("invalid_modifier", "Modifier must have a non-empty plu", `${path}.plu`));
  }
  if (!isNonEmptyString(m.name)) {
    errors.push(err("invalid_modifier", "Modifier must have a non-empty name", `${path}.name`));
  }
  if (!isPositiveIntQty(m.quantity)) {
    errors.push(err("invalid_modifier", "Modifier quantity must be a positive integer", `${path}.quantity`));
  }
  if (!isIntegerCents(m.price) || m.price < 0) {
    errors.push(
      err("invalid_modifier", "Modifier price must be a non-negative integer (cents)", `${path}.price`)
    );
  }
  (m.nestedModifiers ?? []).forEach((nm, i) => {
    validateModifier(nm, `${path}.nestedModifiers[${i}]`, errors, nestDepth + 1);
  });
}

function validateOrderItem(item: DeliverectOrderItem, path: string, errors: DeliverectPayloadValidationError[]): void {
  if (!isNonEmptyString(item.plu)) {
    errors.push(err("missing_field", "Item must have a non-empty plu", `${path}.plu`));
  }
  if (!isNonEmptyString(item.name)) {
    errors.push(err("missing_field", "Item must have a non-empty name", `${path}.name`));
  }
  if (!isPositiveIntQty(item.quantity)) {
    errors.push(err("invalid_quantity", "Item quantity must be a positive integer", `${path}.quantity`));
  }
  if (!isIntegerCents(item.price) || item.price < 0) {
    errors.push(err("invalid_price", "Item price must be a non-negative integer (cents)", `${path}.price`));
  }
  (item.subItems ?? []).forEach((s, i) => {
    validateSubLine(s, `${path}.subItems[${i}]`, errors);
  });
  (item.modifiers ?? []).forEach((m, i) => {
    validateModifier(m, `${path}.modifiers[${i}]`, errors, 0);
  });
}

function sumPayloadSubtotalCents(payload: DeliverectOrderRequest): number {
  return payload.items.reduce((sum, item) => sum + itemExtendedCents(item), 0);
}

function validateExternalProductIds(
  payload: DeliverectOrderRequest,
  vendorOrder: NonNullable<HydratedVendorOrder>,
  errors: DeliverectPayloadValidationError[]
): void {
  const lines = vendorOrder.lineItems;
  if (payload.items.length !== lines.length) {
    return;
  }
  for (let i = 0; i < lines.length; i++) {
    const voLine = lines[i]!;
    const pItem = payload.items[i]!;
    const pid = voLine.menuItem?.deliverectProductId?.trim();
    if (!pid) continue;

    const parentPlu = voLine.menuItem?.deliverectVariantParentPlu?.trim();
    if (parentPlu) {
      const inner = pItem.subItems?.[0];
      if (!inner || !isNonEmptyString(inner.externalProductId)) {
        errors.push(
          err(
            "missing_external_product_id",
            "Variation line must include externalProductId when the menu item has deliverectProductId",
            `items[${i}].subItems[0].externalProductId`
          )
        );
      }
    } else {
      if (!isNonEmptyString(pItem.externalProductId)) {
        errors.push(
          err(
            "missing_external_product_id",
            "Item must include externalProductId when the menu item has deliverectProductId",
            `items[${i}].externalProductId`
          )
        );
      }
    }
  }
}

/**
 * Validate a built {@link DeliverectOrderRequest} before HTTP submission.
 * Pass the same hydrated vendor order used to build the payload for cross-checks.
 */
export function validateDeliverectPayload(
  payload: DeliverectOrderRequest,
  vendorOrder: NonNullable<HydratedVendorOrder>
): DeliverectPayloadValidationResult {
  const errors: DeliverectPayloadValidationError[] = [];

  if (!isNonEmptyString(payload.channelLinkId)) {
    errors.push(err("missing_field", "channelLinkId is required", "channelLinkId"));
  }
  if (!isNonEmptyString(payload.channelOrderId)) {
    errors.push(err("missing_field", "channelOrderId is required", "channelOrderId"));
  }
  if (!isNonEmptyString(payload.channelOrderDisplayId)) {
    errors.push(err("missing_field", "channelOrderDisplayId is required", "channelOrderDisplayId"));
  }
  if (typeof payload.orderType !== "number" || !Number.isFinite(payload.orderType)) {
    errors.push(err("missing_field", "orderType must be a finite number", "orderType"));
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push(err("empty_items", "items must be a non-empty array", "items"));
  }

  payload.items.forEach((item, i) => {
    validateOrderItem(item, `items[${i}]`, errors);
  });

  if (payload.items.length !== vendorOrder.lineItems.length) {
    errors.push(
      err(
        "line_item_count_mismatch",
        `Payload has ${payload.items.length} items but vendor order has ${vendorOrder.lineItems.length} line(s)`,
        "items"
      )
    );
  }

  validateExternalProductIds(payload, vendorOrder, errors);

  const payloadItemsSumCents = sumPayloadSubtotalCents(payload);
  /** Menu + modifiers only — excludes tax, platform fee, and tip (see `vendorOrderItemSubtotalCents`). */
  const expectedItemSubtotalCents = vendorOrderItemSubtotalCents(vendorOrder);
  if (
    Math.abs(payloadItemsSumCents - expectedItemSubtotalCents) > DELIVERECT_PAYLOAD_MONEY_TOLERANCE_CENTS &&
    payload.items.length > 0
  ) {
    errors.push(
      err(
        "price_mismatch",
        `Item line totals (${payloadItemsSumCents}¢) do not match item subtotal excluding tax and fees (${expectedItemSubtotalCents}¢) within ${DELIVERECT_PAYLOAD_MONEY_TOLERANCE_CENTS}¢`,
        "items"
      )
    );
  }

  const taxCents = Math.max(0, Math.round(vendorOrder.taxCents));
  const expectedPayment = deliverectRestaurantFacingPaymentCents({
    subtotalCents: expectedItemSubtotalCents,
    taxCents,
    tipCents: Math.max(0, Math.round(vendorOrder.tipCents)),
  });

  if (payload.payment != null) {
    if (!isIntegerCents(payload.payment.amount) || payload.payment.amount < 0) {
      errors.push(
        err("invalid_payment", "payment.amount must be a non-negative integer (cents)", "payment.amount")
      );
    } else if (
      Math.abs(payload.payment.amount - expectedPayment) > DELIVERECT_PAYLOAD_MONEY_TOLERANCE_CENTS
    ) {
      errors.push(
        err(
          "price_mismatch",
          `payment.amount (${payload.payment.amount}¢) does not match restaurant-facing total (${expectedPayment}¢ = item subtotal excluding tax/fees + tax + tip) within ${DELIVERECT_PAYLOAD_MONEY_TOLERANCE_CENTS}¢`,
          "payment.amount"
        )
      );
    }
    if (typeof payload.payment.type !== "number" || !Number.isFinite(payload.payment.type)) {
      errors.push(err("invalid_payment", "payment.type must be a finite number", "payment.type"));
    }
  } else {
    errors.push(err("invalid_payment", "payment block is required for prepaid channel orders", "payment"));
  }

  const hardErrors = errors.filter((e) => e.severity === "error");
  return {
    isValid: hardErrors.length === 0,
    errors,
  };
}

/** Short label for admin surfaces and logs. */
export function summarizeDeliverectPayloadValidationErrors(errors: DeliverectPayloadValidationError[]): string {
  const hard = errors.filter((e) => e.severity === "error");
  if (hard.length === 0) {
    const w = errors.filter((e) => e.severity === "warning");
    if (w.length === 0) return "Validation passed";
    return `${w.length} warning(s): ${w[0]?.message ?? ""}`;
  }
  const first = hard[0]!;
  return hard.length === 1
    ? first.message
    : `${first.message} (+${hard.length - 1} more)`;
}

export function buildDeliverectPayloadValidationSnapshot(
  errors: DeliverectPayloadValidationError[]
): DeliverectPayloadValidationSnapshot {
  return {
    validatedAt: new Date().toISOString(),
    isValid: false,
    summary: summarizeDeliverectPayloadValidationErrors(errors),
    errors,
  };
}
