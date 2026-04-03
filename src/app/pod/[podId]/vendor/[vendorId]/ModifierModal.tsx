"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  ModifierConfigForUI,
  ModifierGroupLinkForUI,
  ModifierOptionForUI,
} from "./modifier-config";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import { getVariantMergedModifierConfigAction } from "@/actions/variant-modifier-config.actions";
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";
import { maxDeliverectVariantGroupSelectionsForMenuItem } from "@/lib/deliverect-subitem-nesting";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

function modifierGroupSelectionHint(
  minSelections: number,
  maxSelections: number,
  opts?: {
    deliverectVariantGroup?: boolean;
    deliverectMaxVariantSteps?: number | null;
  }
): string {
  if (
    opts?.deliverectVariantGroup &&
    opts.deliverectMaxVariantSteps != null &&
    modifierMaxSelectionsIsUnbounded(maxSelections) &&
    minSelections === 0
  ) {
    return `optional — choose up to ${opts.deliverectMaxVariantSteps} total`;
  }
  if (modifierMaxSelectionsIsUnbounded(maxSelections) && minSelections === 0) {
    return "optional — choose any";
  }
  if (minSelections === maxSelections) {
    return `choose ${minSelections}`;
  }
  return `${minSelections}–${maxSelections} choices`;
}

type SelectionState = Record<string, number>;

/** Matches server {@link assertDeliverectVariantGroupNestingAllowed} — one step per selected option in a variant group. */
function countDeliverectVariantGroupSelectionsInState(
  state: SelectionState,
  cfg: ModifierConfigForUI
): number {
  let n = 0;
  for (const link of cfg.groups) {
    if (!link.modifierGroup.deliverectIsVariantGroup) continue;
    for (const opt of link.modifierGroup.options) {
      if ((state[opt.id] ?? 0) >= 1) n += 1;
    }
  }
  for (const link of cfg.groups) {
    for (const opt of link.modifierGroup.options) {
      if ((state[opt.id] ?? 0) < 1) continue;
      for (const nested of opt.nestedModifierGroups ?? []) {
        if (!nested.deliverectIsVariantGroup) continue;
        for (const nopt of nested.options) {
          if ((state[nopt.id] ?? 0) >= 1) n += 1;
        }
      }
    }
  }
  return n;
}

function totalSelectedInGroup(link: ModifierGroupLinkForUI, state: SelectionState): number {
  let n = 0;
  for (const opt of link.modifierGroup.options) {
    n += state[opt.id] ?? 0;
  }
  return n;
}

function totalSelectedInNested(
  options: ModifierOptionForUI[],
  state: SelectionState
): number {
  let n = 0;
  for (const opt of options) {
    n += state[opt.id] ?? 0;
  }
  return n;
}

/** Nested option ids under a single top-level option (matches one level in serializeModifierConfig). */
function nestedOptionIdsUnderTopLevelOption(option: ModifierOptionForUI): string[] {
  const ids: string[] = [];
  for (const ng of option.nestedModifierGroups ?? []) {
    for (const no of ng.options) ids.push(no.id);
  }
  return ids;
}

function collectAllOptionIds(cfg: ModifierConfigForUI): Set<string> {
  const ids = new Set<string>();
  for (const link of cfg.groups) {
    for (const opt of link.modifierGroup.options) {
      ids.add(opt.id);
      for (const ng of opt.nestedModifierGroups ?? []) {
        for (const n of ng.options) ids.add(n.id);
      }
    }
  }
  return ids;
}

function pruneSelectionsToConfig(selections: SelectionState, cfg: ModifierConfigForUI): SelectionState {
  const allowed = collectAllOptionIds(cfg);
  const next: SelectionState = {};
  for (const [id, qty] of Object.entries(selections)) {
    if (qty >= 1 && allowed.has(id)) next[id] = qty;
  }
  return next;
}

export function ModifierModal({
  config,
  cartId,
  podId,
  vendorId,
  onClose,
  onSuccess,
  /** Edit mode: update existing cart item instead of adding. */
  cartItemId,
  quantity: editQuantity = 1,
  initialSelections,
  initialSpecialInstructions,
  /** When the vendor uses Deliverect, show nesting limits and “choose up to N” on variant groups. */
  vendorUsesDeliverect = false,
  /** From `MenuItem.deliverectVariantParentPlu` — leaf+parent products allow one fewer variant step. */
  menuItemDeliverectVariantParentPlu,
}: {
  config: ModifierConfigForUI;
  cartId: string;
  podId?: string;
  vendorId?: string;
  onClose: () => void;
  onSuccess: () => void;
  cartItemId?: string;
  quantity?: number;
  initialSelections?: Array<{ modifierOptionId: string; quantity: number }>;
  initialSpecialInstructions?: string | null;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
}) {
  const isEditMode = !!cartItemId;

  /** Prefer server flag; fallback to scanning groups (older serialized configs). */
  const isVariantFamily = useMemo(
    () =>
      config.useLeafModifierMerge ??
      config.groups.some((g) => g.modifierGroup.deliverectIsVariantGroup === true),
    [config.groups, config.useLeafModifierMerge]
  );

  const defaults = useMemo(() => {
    if (initialSelections && initialSelections.length > 0) {
      const s: SelectionState = {};
      for (const sel of initialSelections) {
        if (sel.quantity >= 1) s[sel.modifierOptionId] = sel.quantity;
      }
      return s;
    }
    const s: SelectionState = {};
    for (const link of config.groups) {
      let count = 0;
      for (const opt of link.modifierGroup.options) {
        if (count >= link.maxSelections) break;
        if (opt.isDefault && opt.isAvailable) {
          s[opt.id] = 1;
          count += 1;
        }
      }
    }
    return s;
  }, [config.groups, initialSelections]);

  const [selections, setSelections] = useState<SelectionState>(() => defaults);
  const [specialInstructions, setSpecialInstructions] = useState(initialSpecialInstructions ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [displayConfig, setDisplayConfig] = useState<ModifierConfigForUI>(config);

  /** `serializeModifierConfig` returns a new object each parent render; do not reset merged leaf groups for variant families. */
  useEffect(() => {
    if (isEditMode || !isVariantFamily) {
      setDisplayConfig(config);
      return;
    }
    setDisplayConfig((prev) => (prev.menuItemId === config.menuItemId ? prev : config));
  }, [config, isEditMode, isVariantFamily]);

  const selectionsList = useMemo(() => {
    const list: { modifierOptionId: string; quantity: number }[] = [];
    for (const [id, qty] of Object.entries(selections)) {
      if (qty >= 1) list.push({ modifierOptionId: id, quantity: qty });
    }
    return list;
  }, [selections]);

  const maxDeliverectVariantSteps = useMemo(() => {
    if (!vendorUsesDeliverect) return null;
    return maxDeliverectVariantGroupSelectionsForMenuItem(
      Boolean(menuItemDeliverectVariantParentPlu?.trim())
    );
  }, [vendorUsesDeliverect, menuItemDeliverectVariantParentPlu]);

  const deliverectVariantStepCount = useMemo(
    () => countDeliverectVariantGroupSelectionsInState(selections, displayConfig),
    [selections, displayConfig]
  );

  const deliverectVariantOverLimit =
    maxDeliverectVariantSteps != null && deliverectVariantStepCount > maxDeliverectVariantSteps;

  useEffect(() => {
    if (!isVariantFamily || isEditMode) return;
    let cancelled = false;
    const list: { modifierOptionId: string; quantity: number }[] = [];
    for (const [id, qty] of Object.entries(selections)) {
      if (qty >= 1) list.push({ modifierOptionId: id, quantity: qty });
    }
    void (async () => {
      const res = await getVariantMergedModifierConfigAction(config.menuItemId, list);
      if (cancelled || !res?.config) return;
      setDisplayConfig(res.config);
      setSelections((prev) => {
        const next = pruneSelectionsToConfig(prev, res.config);
        const same =
          Object.keys(prev).length === Object.keys(next).length &&
          Object.keys(next).every((k) => prev[k] === next[k]);
        return same ? prev : next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isVariantFamily, isEditMode, config.menuItemId, selections]);

  const setOptionQty = useCallback(
    (optionId: string, delta: number) => {
      setSelections((prev) => {
        const next = { ...prev };
        const cur = next[optionId] ?? 0;
        const v = Math.max(0, cur + delta);
        if (v === 0) {
          delete next[optionId];
          for (const link of displayConfig.groups) {
            for (const opt of link.modifierGroup.options) {
              if (opt.id !== optionId) continue;
              for (const nid of nestedOptionIdsUnderTopLevelOption(opt)) delete next[nid];
            }
          }
        } else {
          next[optionId] = v;
        }
        return next;
      });
      setError(null);
    },
    [displayConfig.groups]
  );

  const totalCents = useMemo(() => {
    let sum = displayConfig.priceCents;
    for (const link of displayConfig.groups) {
      for (const opt of link.modifierGroup.options) {
        const qty = selections[opt.id] ?? 0;
        sum += opt.priceCents * qty;
      }
      for (const opt of link.modifierGroup.options) {
        for (const nested of opt.nestedModifierGroups ?? []) {
          for (const nopt of nested.options) {
            const qty = selections[nopt.id] ?? 0;
            sum += nopt.priceCents * qty;
          }
        }
      }
    }
    return sum;
  }, [displayConfig, selections]);

  const requiredSatisfied = useMemo(() => {
    for (const link of displayConfig.groups) {
      if (!link.modifierGroup.isAvailable) continue;
      const total = totalSelectedInGroup(link, selections);
      if (link.required && total < link.minSelections) return false;
      if (total > link.maxSelections) return false;
    }
    for (const link of displayConfig.groups) {
      for (const opt of link.modifierGroup.options) {
        const qty = selections[opt.id] ?? 0;
        if (qty < 1) continue;
        for (const nested of opt.nestedModifierGroups ?? []) {
          if (!nested.isAvailable) continue;
          const nTotal = totalSelectedInNested(nested.options, selections);
          if (nested.minSelections > 0 && nTotal < nested.minSelections) return false;
          if (nTotal > nested.maxSelections) return false;
        }
      }
    }
    return true;
  }, [displayConfig.groups, selections]);

  const canSubmit = requiredSatisfied && !deliverectVariantOverLimit;

  async function submit() {
    if (!canSubmit) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] submit skipped (canSubmit=false)");
      }
      return;
    }
    setLoading(true);
    setError(null);
    if (isEditMode && cartItemId) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] submit → updateCartItemAction", {
          cartId,
          cartItemId,
          podId,
          vendorId,
        });
      }
      const result = await updateCartItemAction(
        cartId,
        cartItemId,
        editQuantity,
        specialInstructions.trim() || null,
        selectionsList
      );
      setLoading(false);
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] updateCartItemAction returned", { success: result?.success, error: result && !result.success ? result.error : undefined });
      }
      if (result?.success) {
        onSuccess();
        onClose();
      } else if (result && !result.success) {
        setError({ message: result.error, code: result.code });
      }
    } else {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] submit → addToCartAction", {
          cartId,
          menuItemId: displayConfig.menuItemId,
          podId,
          vendorId,
        });
      }
      const result = await addToCartAction(
        cartId,
        displayConfig.menuItemId,
        1,
        specialInstructions.trim() || null,
        selectionsList
      );
      setLoading(false);
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] addToCartAction returned", {
          success: result.success,
          error: "error" in result ? result.error : undefined,
          code: "code" in result ? result.code : undefined,
        });
      }
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError({ message: result.error, code: result.code });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="modifier-modal-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
          <h2 id="modifier-modal-title" className="text-lg font-semibold text-stone-900">
            {displayConfig.menuItemName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-stone-600">
            Base price: ${(displayConfig.priceCents / 100).toFixed(2)}
          </p>

          {vendorUsesDeliverect && maxDeliverectVariantSteps != null && (
            <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
              Online orders allow up to <strong>{maxDeliverectVariantSteps}</strong>{" "}
              {maxDeliverectVariantSteps === 1 ? "variation step" : "variation steps"} total for this
              item (kitchen system limit).
              {deliverectVariantStepCount > 0 && (
                <span className="mt-1 block text-stone-500">
                  {deliverectVariantStepCount} of {maxDeliverectVariantSteps} used.
                </span>
              )}
            </p>
          )}

          {deliverectVariantOverLimit && maxDeliverectVariantSteps != null && (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              Too many variation steps ({deliverectVariantStepCount} selected; max{" "}
              {maxDeliverectVariantSteps} for online orders). Remove some choices to add to cart.
            </p>
          )}

          {displayConfig.groups
            .filter((link) => link.modifierGroup.isAvailable)
            .map((link) => {
              const total = totalSelectedInGroup(link, selections);
              const minOk = total >= link.minSelections;
              const maxOk = total <= link.maxSelections;
              const requiredMissing = link.required && total < link.minSelections;
              return (
                <fieldset key={link.modifierGroup.id} className="rounded-lg border border-stone-200 p-3">
                  <legend className="text-sm font-medium text-stone-900">
                    {link.modifierGroup.name}
                    <span className="ml-1 text-stone-500">
                      (
                      {modifierGroupSelectionHint(link.minSelections, link.maxSelections, {
                        deliverectVariantGroup: link.modifierGroup.deliverectIsVariantGroup === true,
                        deliverectMaxVariantSteps: maxDeliverectVariantSteps,
                      })}
                      {link.required ? ", required" : ""})
                    </span>
                  </legend>
                  {requiredMissing && (
                    <p className="mb-2 text-xs text-red-600" role="alert">
                      Please select at least {link.minSelections} option(s).
                    </p>
                  )}
                  <div className="mt-2 space-y-2">
                    {link.modifierGroup.options.map((opt) => (
                      <OptionRow
                        key={opt.id}
                        option={opt}
                        quantity={selections[opt.id] ?? 0}
                        maxForGroup={link.maxSelections}
                        totalInGroup={total}
                        onIncrease={() => setOptionQty(opt.id, 1)}
                        onDecrease={() => setOptionQty(opt.id, -1)}
                        selections={selections}
                        setOptionQty={setOptionQty}
                        maxDeliverectVariantSteps={maxDeliverectVariantSteps}
                      />
                    ))}
                  </div>
                </fieldset>
              );
            })}

          <div>
            <label htmlFor="modifier-notes" className="block text-sm font-medium text-stone-700">
              Special instructions
            </label>
            <textarea
              id="modifier-notes"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. no onions"
              rows={2}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error.message}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-stone-200 pt-4">
            <span className="font-medium text-stone-900">
              Total: ${(totalCents / 100).toFixed(2)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading || !canSubmit}
                className="rounded-lg bg-mennyu-primary px-4 py-2 text-sm font-medium text-black hover:bg-mennyu-secondary disabled:opacity-50"
              >
                {loading ? (isEditMode ? "Saving…" : "Adding…") : isEditMode ? "Save changes" : "Add to cart"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  option,
  quantity,
  maxForGroup,
  totalInGroup,
  onIncrease,
  onDecrease,
  selections,
  setOptionQty,
  maxDeliverectVariantSteps,
}: {
  option: ModifierOptionForUI;
  quantity: number;
  maxForGroup: number;
  totalInGroup: number;
  onIncrease: () => void;
  onDecrease: () => void;
  selections: SelectionState;
  setOptionQty: (id: string, delta: number) => void;
  maxDeliverectVariantSteps?: number | null;
}) {
  const canAdd = totalInGroup < maxForGroup;
  const disabled = !option.isAvailable;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDecrease()}
            disabled={quantity === 0 || disabled}
            className="h-8 w-8 rounded border border-stone-300 bg-white text-stone-600 disabled:opacity-50"
            aria-label={`Less ${option.name}`}
          >
            −
          </button>
          <span className="min-w-[2ch] text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => onIncrease()}
            disabled={!canAdd || disabled}
            className="h-8 w-8 rounded border border-stone-300 bg-white text-stone-600 disabled:opacity-50"
            aria-label={`More ${option.name}`}
          >
            +
          </button>
        </div>
        <span className={disabled ? "text-stone-400" : "text-stone-900"}>
          {option.name}
          {!option.isAvailable && (
            <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-700">
              Unavailable
            </span>
          )}
          {option.priceCents > 0 && (
            <span className="ml-1 text-stone-500">+${(option.priceCents / 100).toFixed(2)}</span>
          )}
        </span>
      </div>
      {quantity >= 1 && (option.nestedModifierGroups?.length ?? 0) > 0 && (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-stone-200 pl-3">
          {option.nestedModifierGroups!.map((nested) => {
            const nTotal = totalSelectedInNested(nested.options, selections);
            const nRequiredMissing = nested.minSelections > 0 && nTotal < nested.minSelections;
            if (!nested.isAvailable) return null;
            return (
              <fieldset key={nested.id} className="rounded border border-stone-100 p-2">
                <legend className="text-xs font-medium text-stone-700">
                  {nested.name} (
                  {modifierGroupSelectionHint(nested.minSelections, nested.maxSelections, {
                    deliverectVariantGroup: nested.deliverectIsVariantGroup === true,
                    deliverectMaxVariantSteps: maxDeliverectVariantSteps ?? null,
                  })}
                  )
                </legend>
                {nRequiredMissing && (
                  <p className="mb-1 text-xs text-red-600">Select at least {nested.minSelections}.</p>
                )}
                <div className="mt-1 space-y-1">
                  {nested.options.map((nopt) => (
                    <div key={nopt.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOptionQty(nopt.id, -1)}
                          disabled={(selections[nopt.id] ?? 0) === 0 || !nopt.isAvailable}
                          className="h-6 w-6 rounded border border-stone-200 text-xs disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="min-w-[1.5ch] text-xs">{selections[nopt.id] ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => setOptionQty(nopt.id, 1)}
                          disabled={nTotal >= nested.maxSelections || !nopt.isAvailable}
                          className="h-6 w-6 rounded border border-stone-200 text-xs disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      <span className={!nopt.isAvailable ? "text-stone-400" : "text-stone-800"}>
                        {nopt.name}
                        {!nopt.isAvailable && (
                          <span className="ml-1 rounded bg-stone-200 px-1 py-0.5 text-[10px] font-medium text-stone-700">
                            Unavailable
                          </span>
                        )}
                        {nopt.priceCents > 0 && (
                          <span className="text-stone-500"> +${(nopt.priceCents / 100).toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
