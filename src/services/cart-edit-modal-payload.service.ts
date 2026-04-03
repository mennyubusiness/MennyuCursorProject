/**
 * Cart "Edit" modifier modal: batch-friendly loaders to avoid N× Prisma round-trips on /cart SSR.
 */
import "server-only";
import { prisma } from "@/lib/db";
import type { ModifierConfigForUI } from "@/lib/modifier-config";
import { serializeModifierConfig, mergeVariantParentAndLeafModifierConfig } from "@/lib/modifier-config";
import { CUSTOMER_VENDOR_MENU_ITEM_INCLUDE } from "@/services/vendor-customer-menu.service";
import type { CustomerVendorMenuItem } from "@/services/vendor-customer-menu.service";
import {
  augmentSelectionsWithImplicitVariantFromLeaf,
  findDeliverectProductVariantGroupIdForLeaf,
  MENU_ITEM_VARIANT_RESOLUTION_INCLUDE,
  type MenuItemForVariantResolution,
} from "@/services/cart-deliverect-variant-resolution";

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

export type CartEditModifierModalPayload = {
  config: ModifierConfigForUI;
  initialSelections: CartItemSelectionInput[];
} | null;

/** Shared with variant merge action (vendor menu). */
export async function loadMenuItemForSerializeConfig(menuItemId: string) {
  return prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  });
}

/**
 * Core merge logic for cart edit (parent shell + leaf). Prefer {@link loadCartEditModifierPayloadsForCartPage} on /cart.
 */
export async function getCartEditModifierModalPayloadFromLeafRows(
  leafFull: CustomerVendorMenuItem,
  leafSlim: MenuItemForVariantResolution,
  persistedSelections: CartItemSelectionInput[]
): Promise<CartEditModifierModalPayload> {
  const initialSelections = await augmentSelectionsWithImplicitVariantFromLeaf(leafSlim, persistedSelections);

  const pplu = leafFull.deliverectVariantParentPlu?.trim();
  if (!pplu) {
    return {
      config: serializeModifierConfig(leafFull),
      initialSelections,
    };
  }

  const parentFull = await prisma.menuItem.findFirst({
    where: {
      vendorId: leafFull.vendorId,
      deliverectPlu: pplu,
      deliverectVariantParentPlu: null,
    },
    include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  });
  if (!parentFull) {
    return {
      config: serializeModifierConfig(leafFull),
      initialSelections,
    };
  }

  let parentConfig = serializeModifierConfig(parentFull);
  const leafConfig = serializeModifierConfig(leafFull);

  const hasFlaggedVariantOnParent = parentConfig.groups.some(
    (g) => g.modifierGroup.deliverectIsVariantGroup === true
  );
  if (!hasFlaggedVariantOnParent) {
    const variantGroupId = await findDeliverectProductVariantGroupIdForLeaf(parentFull.id, leafFull);
    if (variantGroupId) {
      parentConfig = {
        ...parentConfig,
        groups: parentConfig.groups.map((link) =>
          link.modifierGroup.id === variantGroupId
            ? {
                ...link,
                modifierGroup: {
                  ...link.modifierGroup,
                  deliverectIsVariantGroup: true,
                },
              }
            : link
        ),
        useLeafModifierMerge: true,
      };
    }
  }

  const config = mergeVariantParentAndLeafModifierConfig(parentConfig, leafConfig, {
    menuItemName: parentFull.name,
  });
  return { config, initialSelections };
}

/**
 * Single-call compatibility: loads leaf rows then merges (3+ DB round-trips).
 * @deprecated Prefer {@link loadCartEditModifierPayloadsForCartPage} on cart SSR.
 */
export async function getCartEditModifierModalPayloadSingle(
  leafMenuItemId: string,
  persistedSelections: CartItemSelectionInput[]
): Promise<CartEditModifierModalPayload> {
  const [leafFull, leafSlim] = await Promise.all([
    loadMenuItemForSerializeConfig(leafMenuItemId),
    prisma.menuItem.findUnique({
      where: { id: leafMenuItemId },
      include: MENU_ITEM_VARIANT_RESOLUTION_INCLUDE,
    }),
  ]);
  if (!leafFull || !leafSlim) return null;
  return getCartEditModifierModalPayloadFromLeafRows(leafFull, leafSlim, persistedSelections);
}

export type CartLineForEditPayload = {
  cartItemId: string;
  menuItemId: string;
  persistedSelections: CartItemSelectionInput[];
  /** From slim cart `_count.modifierGroups` — skip work when zero. */
  modifierGroupCount: number;
};

/**
 * Batch-load edit payloads for cart lines: 2 Prisma queries for all leaf menu items, then per-line merge work.
 */
export async function loadCartEditModifierPayloadsForCartPage(
  lines: CartLineForEditPayload[]
): Promise<Map<string, CartEditModifierModalPayload>> {
  const out = new Map<string, CartEditModifierModalPayload>();
  const needs = lines.filter((l) => l.modifierGroupCount > 0);
  if (needs.length === 0) {
    for (const l of lines) out.set(l.cartItemId, null);
    return out;
  }

  const uniqueMenuIds = [...new Set(needs.map((l) => l.menuItemId))];

  const [fullRows, slimRows] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: uniqueMenuIds } },
      include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
    }),
    prisma.menuItem.findMany({
      where: { id: { in: uniqueMenuIds } },
      include: MENU_ITEM_VARIANT_RESOLUTION_INCLUDE,
    }),
  ]);

  const fullById = new Map(fullRows.map((r) => [r.id, r]));
  const slimById = new Map(slimRows.map((r) => [r.id, r]));

  await Promise.all(
    needs.map(async (line) => {
      const leafFull = fullById.get(line.menuItemId);
      const leafSlim = slimById.get(line.menuItemId);
      if (!leafFull || !leafSlim) {
        out.set(line.cartItemId, null);
        return;
      }
      const payload = await getCartEditModifierModalPayloadFromLeafRows(
        leafFull,
        leafSlim,
        line.persistedSelections
      );
      out.set(line.cartItemId, payload);
    })
  );

  for (const l of lines) {
    if (!out.has(l.cartItemId)) out.set(l.cartItemId, null);
  }
  return out;
}
