/**
 * Deliverect variant families: parent shell MenuItem (e.g. PLU P-SPICY-RANCH) + variant-group
 * selections (size) must map to a leaf MenuItem row (e.g. VAR-SMALL…) for cart/order lines.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CartValidationError } from "@/services/cart-validation-error";

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

const menuItemVariantInclude = {
  vendor: true,
  modifierGroups: {
    include: {
      modifierGroup: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          deliverectIsVariantGroup: true,
        },
      },
    },
  },
} satisfies Prisma.MenuItemInclude;

export type MenuItemForVariantResolution = Prisma.MenuItemGetPayload<{
  include: typeof menuItemVariantInclude;
}>;

/**
 * When the UI uses the parent shell `MenuItem` and the customer picks variant-group options,
 * resolve to the leaf `MenuItem` and drop variant-group selections from persisted cart selections
 * (the choice is encoded in the leaf row).
 */
/**
 * Modifier rules (required groups, min/max) are attached to the parent shell. When the cart line
 * references a leaf `MenuItem`, validate using the parent row.
 */
/**
 * Cart lines store the leaf `MenuItem` and omit variant-group rows from persisted selections.
 * When the customer edits the line, the modal may send only non-variant options — re-inject the
 * variant choice implied by the leaf row so validation and re-resolution succeed.
 */
export async function augmentSelectionsWithImplicitVariantFromLeaf(
  leaf: MenuItemForVariantResolution,
  selections: CartItemSelectionInput[]
): Promise<CartItemSelectionInput[]> {
  const parentPlu = leaf.deliverectVariantParentPlu?.trim();
  const leafPlu = leaf.deliverectPlu?.trim();
  if (!parentPlu || !leafPlu) return selections;

  const parent = await findParentShellMenuItemByPlu(leaf.vendorId, parentPlu);
  if (!parent) return selections;

  const selIds = selections.map((s) => s.modifierOptionId);
  if (selIds.length > 0) {
    const selectedOpts = await prisma.modifierOption.findMany({
      where: { id: { in: selIds } },
      include: { modifierGroup: { select: { deliverectIsVariantGroup: true } } },
    });
    if (selectedOpts.some((o) => o.modifierGroup.deliverectIsVariantGroup === true)) {
      return selections;
    }
  }

  const variantOpt = await prisma.modifierOption.findFirst({
    where: {
      deliverectModifierPlu: leafPlu,
      modifierGroup: {
        deliverectIsVariantGroup: true,
        menuItems: { some: { menuItemId: parent.id } },
      },
    },
  });
  if (!variantOpt) return selections;

  return [{ modifierOptionId: variantOpt.id, quantity: 1 }, ...selections];
}

export async function menuItemForModifierValidation(
  menuItem: MenuItemForVariantResolution
): Promise<MenuItemForVariantResolution> {
  const pplu = menuItem.deliverectVariantParentPlu?.trim();
  if (!pplu) return menuItem;
  const parent = await findParentShellMenuItemByPlu(menuItem.vendorId, pplu);
  if (!parent) {
    throw new CartValidationError(
      "Could not load the product configuration for this item. Try clearing the cart and adding again.",
      "VARIANT_PARENT_SHELL_NOT_FOUND",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }
  return parent;
}

export async function resolveDeliverectVariantLeafForCartLine(args: {
  /** Row from DB (parent shell or already a leaf). */
  menuItem: MenuItemForVariantResolution;
  selections: CartItemSelectionInput[] | null | undefined;
}): Promise<{
  menuItem: MenuItemForVariantResolution;
  selections: CartItemSelectionInput[] | null;
}> {
  let { menuItem } = args;
  let selections = args.selections ?? null;

  if (menuItem.deliverectVariantParentPlu?.trim()) {
    if (!selections?.length) {
      return { menuItem, selections };
    }
    const parent = await findParentShellMenuItemByPlu(
      menuItem.vendorId,
      menuItem.deliverectVariantParentPlu.trim()
    );
    if (!parent) {
      throw new CartValidationError(
        "Could not load the product family for this item. Try clearing the cart and adding again.",
        "VARIANT_PARENT_SHELL_NOT_FOUND",
        { menuItemId: menuItem.id, menuItemName: menuItem.name }
      );
    }
    menuItem = parent;
  }

  const hasVariantGroupOnItem = menuItem.modifierGroups.some(
    (l) => l.modifierGroup.deliverectIsVariantGroup === true
  );
  if (!hasVariantGroupOnItem) {
    return { menuItem, selections };
  }

  if (!selections?.length) {
    throw new CartValidationError(
      "Please select a valid option for each required size or variation group.",
      "VARIANT_GROUP_REQUIRED",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }

  const optionRows = await prisma.modifierOption.findMany({
    where: { id: { in: selections.map((s) => s.modifierOptionId) } },
    include: {
      modifierGroup: { select: { id: true, deliverectIsVariantGroup: true } },
    },
  });
  const byId = new Map(optionRows.map((o) => [o.id, o]));

  const variantSelected: typeof optionRows = [];
  const nonVariantSelections: CartItemSelectionInput[] = [];
  for (const s of selections) {
    if (s.quantity < 1) continue;
    const opt = byId.get(s.modifierOptionId);
    if (!opt) {
      throw new CartValidationError("Invalid modifier selection.", "INVALID_MODIFIER_OPTION", {
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
      });
    }
    if (opt.modifierGroup.deliverectIsVariantGroup === true) {
      variantSelected.push(opt);
    } else {
      nonVariantSelections.push(s);
    }
  }

  if (variantSelected.length === 0) {
    throw new CartValidationError(
      "Please select a valid option for each required size or variation group.",
      "VARIANT_GROUP_REQUIRED",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }

  const parentPlu = menuItem.deliverectPlu?.trim();
  if (!parentPlu) {
    throw new CartValidationError(
      "This menu item is missing a Deliverect PLU; cannot resolve a variant. Republish the menu.",
      "VARIANT_FAMILY_PARENT_PLU_MISSING",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }

  const variantPlus = variantSelected
    .map((o) => o.deliverectModifierPlu?.trim())
    .filter((p): p is string => Boolean(p));
  if (variantPlus.length !== variantSelected.length) {
    throw new CartValidationError(
      "A size or variation option is missing a Deliverect PLU. Republish the menu.",
      "VARIANT_OPTION_PLU_MISSING",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }

  const leaf = await prisma.menuItem.findFirst({
    where: {
      vendorId: menuItem.vendorId,
      deliverectVariantParentPlu: parentPlu,
      deliverectPlu: { in: variantPlus },
      isAvailable: true,
    },
    include: menuItemVariantInclude,
  });

  if (!leaf) {
    throw new CartValidationError(
      "No menu row matches the selected variation. Try again or contact support.",
      "VARIANT_LEAF_MENU_ITEM_NOT_FOUND",
      { menuItemId: menuItem.id, menuItemName: menuItem.name }
    );
  }

  const remapped = await remapSelectionsToLeafMenuItemIfNeeded(leaf.id, nonVariantSelections);
  return { menuItem: leaf, selections: remapped.length > 0 ? remapped : null };
}

/**
 * When parent and leaf share the same ModifierGroup links, option ids are unchanged.
 * If not, map by `deliverectModifierId` within groups attached to the leaf.
 */
async function remapSelectionsToLeafMenuItemIfNeeded(
  leafMenuItemId: string,
  selections: CartItemSelectionInput[]
): Promise<CartItemSelectionInput[]> {
  if (selections.length === 0) return selections;

  const leaf = await prisma.menuItem.findUnique({
    where: { id: leafMenuItemId },
    include: {
      modifierGroups: {
        include: {
          modifierGroup: {
            include: {
              options: {
                include: {
                  nestedModifierGroups: {
                    include: { options: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!leaf) return selections;

  const allowed = new Set<string>();
  for (const link of leaf.modifierGroups) {
    for (const o of link.modifierGroup.options) {
      allowed.add(o.id);
      for (const ng of o.nestedModifierGroups) {
        for (const no of ng.options) allowed.add(no.id);
      }
    }
  }

  const out: CartItemSelectionInput[] = [];
  for (const s of selections) {
    if (s.quantity < 1) continue;
    if (allowed.has(s.modifierOptionId)) {
      out.push(s);
      continue;
    }
    const src = await prisma.modifierOption.findUnique({
      where: { id: s.modifierOptionId },
      select: { deliverectModifierId: true },
    });
    const dmid = src?.deliverectModifierId?.trim();
    if (!dmid) {
      throw new CartValidationError(
        "A modifier on this item could not be matched to the selected size. Try clearing the cart and adding again.",
        "VARIANT_LEAF_MODIFIER_MAPPING_FAILED",
        { menuItemId: leafMenuItemId, menuItemName: leaf.name }
      );
    }
    const match = await prisma.modifierOption.findFirst({
      where: {
        deliverectModifierId: dmid,
        modifierGroup: { menuItems: { some: { menuItemId: leafMenuItemId } } },
      },
    });
    if (!match) {
      throw new CartValidationError(
        "A modifier on this item could not be matched to the selected size. Try clearing the cart and adding again.",
        "VARIANT_LEAF_MODIFIER_MAPPING_FAILED",
        { menuItemId: leafMenuItemId, menuItemName: leaf.name }
      );
    }
    out.push({ modifierOptionId: match.id, quantity: s.quantity });
  }
  return out;
}

export async function loadMenuItemForVariantResolution(
  menuItemId: string
): Promise<MenuItemForVariantResolution | null> {
  return prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: menuItemVariantInclude,
  });
}

/**
 * Parent shell MenuItem where `deliverectPlu` matches the variant-parent PLU stored on leaf rows.
 */
export async function findParentShellMenuItemByPlu(
  vendorId: string,
  parentPlu: string
): Promise<MenuItemForVariantResolution | null> {
  return prisma.menuItem.findFirst({
    where: {
      vendorId,
      deliverectPlu: parentPlu.trim(),
      deliverectVariantParentPlu: null,
    },
    include: menuItemVariantInclude,
  });
}
