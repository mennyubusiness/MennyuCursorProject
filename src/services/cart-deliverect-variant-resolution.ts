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

  const parentShellVariantGroupIds = new Set(
    parent.modifierGroups
      .filter((l) => l.modifierGroup.deliverectIsVariantGroup === true)
      .map((l) => l.modifierGroup.id)
  );

  const selIds = selections.map((s) => s.modifierOptionId);
  if (selIds.length > 0) {
    const selectedOpts = await prisma.modifierOption.findMany({
      where: { id: { in: selIds } },
      select: { modifierGroupId: true },
    });
    if (selectedOpts.some((o) => parentShellVariantGroupIds.has(o.modifierGroupId))) {
      return selections;
    }
  }

  const variantOpt = await prisma.modifierOption.findFirst({
    where:
      parentShellVariantGroupIds.size > 0
        ? {
            deliverectModifierPlu: leafPlu,
            modifierGroupId: { in: [...parentShellVariantGroupIds] },
            modifierGroup: { menuItems: { some: { menuItemId: parent.id } } },
          }
        : {
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
  /**
   * Sum of (price × qty) for parent-shell variant options (size) that are **not** persisted on the
   * cart line. Add to `menuItem.priceCents` when computing line totals so base + size is not lost.
   */
  variantSelectionsPriceCents: number;
}> {
  let { menuItem } = args;
  let selections = args.selections ?? null;

  if (menuItem.deliverectVariantParentPlu?.trim()) {
    if (!selections?.length) {
      return { menuItem, selections, variantSelectionsPriceCents: 0 };
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
    return { menuItem, selections, variantSelectionsPriceCents: 0 };
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
    select: {
      id: true,
      modifierGroupId: true,
      deliverectModifierPlu: true,
      priceCents: true,
      modifierGroup: { select: { id: true, deliverectIsVariantGroup: true } },
    },
  });
  const byId = new Map(optionRows.map((o) => [o.id, o]));

  /** Only options under groups linked to the parent shell as variant (e.g. size). Do not use the global `deliverectIsVariantGroup` flag — leaf-only groups may be mis-tagged and must stay in non-variant selections. */
  const parentShellVariantGroupIds = new Set(
    menuItem.modifierGroups
      .filter((l) => l.modifierGroup.deliverectIsVariantGroup === true)
      .map((l) => l.modifierGroup.id)
  );

  const variantSelected: typeof optionRows = [];
  const nonVariantSelections: CartItemSelectionInput[] = [];
  let variantSelectionsPriceCents = 0;
  for (const s of selections) {
    if (s.quantity < 1) continue;
    const opt = byId.get(s.modifierOptionId);
    if (!opt) {
      throw new CartValidationError("Invalid modifier selection.", "INVALID_MODIFIER_OPTION", {
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
      });
    }
    if (parentShellVariantGroupIds.has(opt.modifierGroupId)) {
      variantSelected.push(opt);
      variantSelectionsPriceCents += opt.priceCents * s.quantity;
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
  return {
    menuItem: leaf,
    selections: remapped.length > 0 ? remapped : null,
    variantSelectionsPriceCents,
  };
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

/**
 * List price for the product family: parent shell when the row is a variant leaf, otherwise the row's own price.
 * Cart line totals must match the vendor modal: shell base + size charge + other modifiers — not leaf list + size again.
 */
export async function shellBasePriceCentsForMenuItem(
  menuItem: Pick<MenuItemForVariantResolution, "vendorId" | "priceCents" | "deliverectVariantParentPlu">
): Promise<number> {
  const pplu = menuItem.deliverectVariantParentPlu?.trim();
  if (!pplu) return menuItem.priceCents;
  const parent = await findParentShellMenuItemByPlu(menuItem.vendorId, pplu);
  return parent?.priceCents ?? menuItem.priceCents;
}

async function findVariantModifierOptionForLeaf(
  leaf: Pick<MenuItemForVariantResolution, "vendorId" | "deliverectPlu" | "deliverectVariantParentPlu">
): Promise<{ priceCents: number; name: string } | null> {
  const parentPlu = leaf.deliverectVariantParentPlu?.trim();
  const leafPlu = leaf.deliverectPlu?.trim();
  if (!parentPlu || !leafPlu) return null;
  const parent = await findParentShellMenuItemByPlu(leaf.vendorId, parentPlu);
  if (!parent) return null;
  const parentShellVariantGroupIds = new Set(
    parent.modifierGroups
      .filter((l) => l.modifierGroup.deliverectIsVariantGroup === true)
      .map((l) => l.modifierGroup.id)
  );
  const variantOpt = await prisma.modifierOption.findFirst({
    where:
      parentShellVariantGroupIds.size > 0
        ? {
            deliverectModifierPlu: leafPlu,
            modifierGroupId: { in: [...parentShellVariantGroupIds] },
            modifierGroup: { menuItems: { some: { menuItemId: parent.id } } },
          }
        : {
            deliverectModifierPlu: leafPlu,
            modifierGroup: {
              deliverectIsVariantGroup: true,
              menuItems: { some: { menuItemId: parent.id } },
            },
          },
    select: { priceCents: true, name: true },
  });
  return variantOpt ?? null;
}

/**
 * Size/variation charge implied by a leaf row when variant-group rows are omitted from persisted cart selections.
 * Matches the parent-shell variant option whose `deliverectModifierPlu` equals the leaf's `deliverectPlu`.
 */
export async function variantSelectionsPriceCentsForLeafCartLine(
  leaf: Pick<MenuItemForVariantResolution, "vendorId" | "deliverectPlu" | "deliverectVariantParentPlu">
): Promise<number> {
  const o = await findVariantModifierOptionForLeaf(leaf);
  return o?.priceCents ?? 0;
}

/** Customer-facing label for the selected size/variation (e.g. "Medium") for cart/checkout display. */
export async function getVariantOptionDisplayNameForLeaf(
  vendorId: string,
  deliverectVariantParentPlu: string | null | undefined,
  deliverectLeafPlu: string | null | undefined
): Promise<string | null> {
  const o = await findVariantModifierOptionForLeaf({
    vendorId,
    deliverectPlu: deliverectLeafPlu ?? null,
    deliverectVariantParentPlu: deliverectVariantParentPlu ?? null,
  });
  return o?.name ?? null;
}

const SHELL_BASE_KEY_SEP = "\u001e";

/** Map key for parent-shell lookups — parent shell PLU is the variant-family id on leaf rows. */
export function shellBasePriceKey(vendorId: string, parentPlu: string): string {
  return `${vendorId}${SHELL_BASE_KEY_SEP}${parentPlu.trim()}`;
}

export type ParentShellCartInfo = {
  priceCents: number;
  name: string;
  imageUrl: string | null;
};

/** Batch-load parent shell rows (name, image, list price) for variant leaf cart lines. */
export async function getParentShellInfoByVendorParentPlu(
  items: Array<{ vendorId: string; menuItem: { deliverectVariantParentPlu?: string | null } }>
): Promise<Map<string, ParentShellCartInfo>> {
  const keys = new Set<string>();
  for (const item of items) {
    const p = item.menuItem.deliverectVariantParentPlu?.trim();
    if (p) keys.add(shellBasePriceKey(item.vendorId, p));
  }
  if (keys.size === 0) return new Map();
  const orClause = [...keys].map((k) => {
    const sep = k.indexOf(SHELL_BASE_KEY_SEP);
    const vendorId = k.slice(0, sep);
    const plu = k.slice(sep + SHELL_BASE_KEY_SEP.length);
    return { vendorId, deliverectPlu: plu, deliverectVariantParentPlu: null };
  });
  const parents = await prisma.menuItem.findMany({
    where: { OR: orClause },
    select: { vendorId: true, deliverectPlu: true, priceCents: true, name: true, imageUrl: true },
  });
  return new Map(
    parents.map((p) => [
      shellBasePriceKey(p.vendorId, p.deliverectPlu ?? ""),
      {
        priceCents: p.priceCents,
        name: p.name,
        imageUrl: p.imageUrl,
      },
    ])
  );
}

/** @deprecated Use {@link getParentShellInfoByVendorParentPlu} when name/image are needed. */
export async function getShellBasePriceCentsByVendorParentPlu(
  items: Array<{ vendorId: string; menuItem: { deliverectVariantParentPlu?: string | null } }>
): Promise<Map<string, number>> {
  const m = await getParentShellInfoByVendorParentPlu(items);
  return new Map([...m.entries()].map(([k, v]) => [k, v.priceCents]));
}
