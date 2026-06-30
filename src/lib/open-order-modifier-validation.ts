export type ModifierGroupBounds = {
  required: boolean;
  minSelections: number;
  maxSelections: number;
};

export function validateModifierGroupBounds(
  input: ModifierGroupBounds
): { ok: true; bounds: ModifierGroupBounds } | { ok: false; error: string } {
  const min = input.minSelections;
  const max = input.maxSelections;

  if (!Number.isInteger(min) || min < 0) {
    return { ok: false, error: "Min selections must be a whole number of 0 or more." };
  }
  if (!Number.isInteger(max) || max < 1) {
    return { ok: false, error: "Max selections must be at least 1." };
  }
  if (max < min) {
    return { ok: false, error: "Max selections cannot be less than min selections." };
  }
  if (input.required && min < 1) {
    return { ok: false, error: "Required groups must have min selections of at least 1." };
  }
  if (!input.required && min > 0 && min > max) {
    return { ok: false, error: "Max selections cannot be less than min selections." };
  }

  return {
    ok: true,
    bounds: {
      required: input.required,
      minSelections: min,
      maxSelections: max,
    },
  };
}

export function isModifierGroupEffectivelyRequired(bounds: ModifierGroupBounds): boolean {
  return bounds.required || bounds.minSelections > 0;
}

export type OpenOrderModifierOptionValidationRow = {
  name: string;
  priceCents: number;
  isAvailable: boolean;
};

export type OpenOrderModifierGroupValidationRow = {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  isAvailable: boolean;
  options: OpenOrderModifierOptionValidationRow[];
};

export function toModifierValidationRow(
  group: {
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    isAvailable: boolean;
    options: OpenOrderModifierOptionValidationRow[];
  }
): OpenOrderModifierGroupValidationRow {
  return {
    name: group.name,
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    isAvailable: group.isAvailable,
    options: group.options.map((opt) => ({
      name: opt.name,
      priceCents: opt.priceCents,
      isAvailable: opt.isAvailable,
    })),
  };
}

export function validateOpenOrderModifierGroupRow(
  group: OpenOrderModifierGroupValidationRow,
  ctx: { itemName: string }
): string | null {
  const boundsCheck = validateModifierGroupBounds({
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
  });
  if (!boundsCheck.ok) {
    if (boundsCheck.error.includes("Max selections cannot be less than min")) {
      return `"${group.name}" has max selections lower than min selections.`;
    }
    return boundsCheck.error;
  }

  if (!group.name.trim()) {
    return `Modifier group for "${ctx.itemName}" needs a name.`;
  }

  if (group.options.length === 0) {
    return `Modifier group "${group.name}" on "${ctx.itemName}" needs at least one option.`;
  }

  for (const opt of group.options) {
    if (!opt.name.trim()) {
      return `Every option in "${group.name}" on "${ctx.itemName}" needs a name.`;
    }
    if (!Number.isInteger(opt.priceCents) || opt.priceCents < 0) {
      return `Option "${opt.name}" in "${group.name}" needs a valid price adjustment.`;
    }
  }

  const required = isModifierGroupEffectivelyRequired(boundsCheck.bounds);
  if (required && group.isAvailable) {
    const availableCount = group.options.filter((o) => o.isAvailable).length;
    if (availableCount < boundsCheck.bounds.minSelections) {
      if (availableCount === 0) {
        return `"${ctx.itemName}" has a required modifier group with no available options (${group.name}).`;
      }
      return `Required group "${group.name}" on "${ctx.itemName}" needs at least ${boundsCheck.bounds.minSelections} available option(s).`;
    }
  }

  return null;
}
