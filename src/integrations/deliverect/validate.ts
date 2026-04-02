/**
 * Validate hydrated VendorOrder has required Deliverect identifiers before live submission.
 * Prevents sending malformed payloads when product/modifier mappings are incomplete.
 */
import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
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
    }
  | {
      valid: false;
      error: string;
      code: "VARIANT_PARENT_MISSING";
    }
  | {
      valid: false;
      error: string;
      code: "MENU_REPUBLISH_REQUIRED";
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

  for (const line of vendorOrder.lineItems) {
    const hasVariantGroupSel = line.selections.some(
      (s) => s.modifierOption.modifierGroup.deliverectIsVariantGroup === true
    );
    if (hasVariantGroupSel && !line.menuItem?.deliverectVariantParentPlu?.trim()) {
      return {
        valid: false,
        error:
          "A line uses Deliverect variant-group selections (e.g. size), but the menu item has no variant parent PLU. Republish the menu after import so live rows receive variant metadata.",
        code: "VARIANT_PARENT_MISSING",
      };
    }
  }

  return { valid: true };
}

/**
 * Live `MenuItem` rows must match the latest published canonical for variant parents.
 * Blocks submission when the snapshot says a product is a variation leaf but the row was never updated.
 */
export async function validateLiveMenuItemsAgainstPublishedCanonicalVariantParents(
  vendorOrder: NonNullable<HydratedVendorOrder>
): Promise<ValidationResult> {
  const vendorId = vendorOrder.vendor.id;
  const published = await prisma.menuVersion.findFirst({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { canonicalSnapshot: true },
  });
  if (!published?.canonicalSnapshot) {
    return { valid: true };
  }
  const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
  if (!parsed.success) {
    return { valid: true };
  }
  const byProductId = new Map(parsed.data.products.map((p) => [p.deliverectId, p]));
  for (const line of vendorOrder.lineItems) {
    const pid = line.menuItem?.deliverectProductId?.trim();
    if (!pid) continue;
    const canon = byProductId.get(pid);
    if (canon?.deliverectVariantParentPlu && !line.menuItem?.deliverectVariantParentPlu?.trim()) {
      return {
        valid: false,
        error: `Menu item "${line.menuItem?.name ?? line.menuItemId}" must have Deliverect variant parent PLU per published menu, but the live row is missing it. Republish the menu import.`,
        code: "MENU_REPUBLISH_REQUIRED",
      };
    }
  }
  return { valid: true };
}
