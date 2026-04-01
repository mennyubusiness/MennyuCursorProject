/**
 * Validate hydrated VendorOrder has required Deliverect identifiers before live submission.
 * Prevents sending malformed payloads when product/modifier mappings are incomplete.
 */
import type { HydratedVendorOrder } from "./load";

export type ValidationResult =
  | { valid: true }
  | {
      valid: false;
      error: string;
      code: "MISSING_CHANNEL_LINK";
      missingChannelLinkId?: boolean;
    }
  | {
      valid: false;
      error: string;
      code: "MISSING_EXTERNAL_IDS";
      missingProductIds: string[];
      missingModifierIds: string[];
    };

/**
 * Validate that a hydrated VendorOrder has all identifiers required for Deliverect submission.
 * - Vendor must have channel link ID (or VendorOrder override).
 * - Every line item's menu item must have `deliverectPlu` (POS PLU for channel `plu` field).
 * - Every modifier selection's option must have `deliverectModifierPlu`.
 * `deliverectProductId` / `deliverectModifierId` (Mongo-style ids) are optional `external*` refs only.
 */
export function validateForSubmission(
  vendorOrder: NonNullable<HydratedVendorOrder>,
  channelLinkId: string | null | undefined
): ValidationResult {
  if (!channelLinkId || String(channelLinkId).trim() === "") {
    return {
      valid: false,
      error: "Vendor has no Deliverect channel link ID; cannot submit.",
      code: "MISSING_CHANNEL_LINK",
      missingChannelLinkId: true,
    };
  }

  const missingProductIds: string[] = [];
  const missingModifierIds: string[] = [];

  for (const line of vendorOrder.lineItems) {
    const productPlu = line.menuItem?.deliverectPlu?.trim();
    if (!productPlu) {
      const label = line.menuItem?.name
        ? `${line.menuItem.name} (${line.menuItemId})`
        : line.menuItemId;
      missingProductIds.push(label);
    }
    for (const sel of line.selections) {
      const modPlu = sel.modifierOption.deliverectModifierPlu?.trim();
      if (!modPlu) {
        const label = sel.modifierOption.name
          ? `${sel.modifierOption.name} (${sel.modifierOptionId})`
          : sel.modifierOptionId;
        missingModifierIds.push(label);
      }
    }
  }

  if (missingProductIds.length > 0 || missingModifierIds.length > 0) {
    const parts: string[] = [];
    if (missingProductIds.length > 0) {
      parts.push(
        `Missing Deliverect PLU for menu item: ${[...new Set(missingProductIds)].join(", ")}`
      );
    }
    if (missingModifierIds.length > 0) {
      parts.push(
        `Missing Deliverect PLU for modifier option: ${[...new Set(missingModifierIds)].join(", ")}`
      );
    }
    return {
      valid: false,
      error: parts.join(" "),
      code: "MISSING_EXTERNAL_IDS",
      missingProductIds: [...new Set(missingProductIds)],
      missingModifierIds: [...new Set(missingModifierIds)],
    };
  }

  return { valid: true };
}
