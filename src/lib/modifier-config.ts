/**
 * Shared modifier config types and serialization for add-to-cart and cart-edit UI.
 * Only top-level groups are included; nested groups are under options.
 */

export interface ModifierOptionForUI {
  id: string;
  name: string;
  priceCents: number;
  sortOrder: number;
  isDefault: boolean;
  isAvailable: boolean;
  nestedModifierGroups?: NestedModifierGroupForUI[];
}

export interface NestedModifierGroupForUI {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  isAvailable: boolean;
  options: Omit<ModifierOptionForUI, "nestedModifierGroups">[];
}

export interface ModifierGroupLinkForUI {
  required: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  modifierGroup: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    isAvailable: boolean;
    /** Deliverect variant group (size) — only on parent shell; leaf rows use non-variant groups (e.g. crust). */
    deliverectIsVariantGroup?: boolean | null;
    options: ModifierOptionForUI[];
  };
}

export interface ModifierConfigForUI {
  menuItemId: string;
  menuItemName: string;
  priceCents: number;
  groups: ModifierGroupLinkForUI[];
}

type MenuItemWithModifiers = {
  id: string;
  name: string;
  priceCents: number;
  modifierGroups: Array<{
    required: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    modifierGroup: {
      id: string;
      name: string;
      minSelections: number;
      maxSelections: number;
      isRequired: boolean;
      isAvailable: boolean;
      deliverectIsVariantGroup?: boolean | null;
      parentModifierOptionId?: string | null;
      options: Array<{
        id: string;
        name: string;
        priceCents: number;
        sortOrder: number;
        isDefault: boolean;
        isAvailable: boolean;
        nestedModifierGroups: Array<{
          id: string;
          name: string;
          minSelections: number;
          maxSelections: number;
          isRequired: boolean;
          isAvailable: boolean;
          options: Array<{
            id: string;
            name: string;
            priceCents: number;
            sortOrder: number;
            isDefault: boolean;
            isAvailable: boolean;
          }>;
        }>;
      }>;
    };
  }>;
};

export function serializeModifierConfig(item: MenuItemWithModifiers): ModifierConfigForUI {
  const groups: ModifierGroupLinkForUI[] = item.modifierGroups
    .filter((link) => link.modifierGroup.parentModifierOptionId == null)
    .map((link) => ({
      required: link.required,
      minSelections: link.minSelections,
      maxSelections: link.maxSelections,
      sortOrder: link.sortOrder,
      modifierGroup: {
        id: link.modifierGroup.id,
        name: link.modifierGroup.name,
        minSelections: link.modifierGroup.minSelections,
        maxSelections: link.modifierGroup.maxSelections,
        isRequired: link.modifierGroup.isRequired,
        isAvailable: link.modifierGroup.isAvailable,
        deliverectIsVariantGroup: link.modifierGroup.deliverectIsVariantGroup ?? null,
        options: link.modifierGroup.options.map(
          (opt): ModifierOptionForUI => ({
            id: opt.id,
            name: opt.name,
            priceCents: opt.priceCents,
            sortOrder: opt.sortOrder,
            isDefault: opt.isDefault,
            isAvailable: opt.isAvailable,
            nestedModifierGroups: opt.nestedModifierGroups.map(
              (ng): NestedModifierGroupForUI => ({
                id: ng.id,
                name: ng.name,
                minSelections: ng.minSelections,
                maxSelections: ng.maxSelections,
                isRequired: ng.isRequired,
                isAvailable: ng.isAvailable,
                options: ng.options.map((o) => ({
                  id: o.id,
                  name: o.name,
                  priceCents: o.priceCents,
                  sortOrder: o.sortOrder,
                  isDefault: o.isDefault,
                  isAvailable: o.isAvailable,
                })),
              })
            ),
          })
        ),
      },
    }));
  return {
    menuItemId: item.id,
    menuItemName: item.name,
    priceCents: item.priceCents,
    groups,
  };
}

/**
 * Combine parent shell variant group(s) (size) with all non-variant groups from the resolved leaf
 * (crust, toppings, …). Server-side validation uses the leaf; the UI must show the same groups.
 */
export function mergeVariantParentAndLeafModifierConfig(
  parentConfig: ModifierConfigForUI,
  leafConfig: ModifierConfigForUI,
  opts?: { menuItemName?: string; priceCents?: number }
): ModifierConfigForUI {
  const variantGroups = parentConfig.groups.filter(
    (g) => g.modifierGroup.deliverectIsVariantGroup === true
  );
  const leafNonVariant = leafConfig.groups.filter(
    (g) => g.modifierGroup.deliverectIsVariantGroup !== true
  );
  const merged = [...variantGroups, ...leafNonVariant].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    menuItemId: parentConfig.menuItemId,
    menuItemName: opts?.menuItemName ?? parentConfig.menuItemName,
    priceCents: opts?.priceCents ?? leafConfig.priceCents,
    groups: merged,
  };
}
