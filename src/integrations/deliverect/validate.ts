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
 * - Every line item's menu item must have deliverectProductId.
 * - Every modifier selection's option must have deliverectModifierId.
 * Use before building payload when ROUTING_MODE=deliverect to fail fast with clear errors.
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
    const productId = line.menuItem?.deliverectProductId;
    if (!productId || String(productId).trim() === "") {
      missingProductIds.push(line.menuItemId);
    }
    for (const sel of line.selections) {
      const modifierId = sel.modifierOption.deliverectModifierId;
      if (!modifierId || String(modifierId).trim() === "") {
        missingModifierIds.push(sel.modifierOptionId);
      }
    }
  }

  if (missingProductIds.length > 0 || missingModifierIds.length > 0) {
    const parts: string[] = [];
    if (missingProductIds.length > 0) {
      parts.push(`missing deliverectProductId for menu items: ${missingProductIds.join(", ")}`);
    }
    if (missingModifierIds.length > 0) {
      parts.push(`missing deliverectModifierId for modifier options: ${missingModifierIds.join(", ")}`);
    }
    return {
      valid: false,
      error: `Incomplete Deliverect mapping: ${parts.join("; ")}`,
      code: "MISSING_EXTERNAL_IDS",
      missingProductIds: [...new Set(missingProductIds)],
      missingModifierIds: [...new Set(missingModifierIds)],
    };
  }

  return { valid: true };
}
