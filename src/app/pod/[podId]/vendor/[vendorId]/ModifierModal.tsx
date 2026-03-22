"use client";

import { useState, useCallback, useMemo } from "react";
import type { ModifierConfigForUI, ModifierGroupLinkForUI, ModifierOptionForUI } from "./modifier-config";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";

function modifierGroupSelectionHint(minSelections: number, maxSelections: number): string {
  if (modifierMaxSelectionsIsUnbounded(maxSelections) && minSelections === 0) {
    return "optional — choose any";
  }
  if (minSelections === maxSelections) {
    return `choose ${minSelections}`;
  }
  return `${minSelections}–${maxSelections} choices`;
}

type SelectionState = Record<string, number>;

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

export function ModifierModal({
  config,
  cartId,
  onClose,
  onSuccess,
  /** Edit mode: update existing cart item instead of adding. */
  cartItemId,
  quantity: editQuantity = 1,
  initialSelections,
  initialSpecialInstructions,
}: {
  config: ModifierConfigForUI;
  cartId: string;
  onClose: () => void;
  onSuccess: () => void;
  cartItemId?: string;
  quantity?: number;
  initialSelections?: Array<{ modifierOptionId: string; quantity: number }>;
  initialSpecialInstructions?: string | null;
}) {
  const isEditMode = !!cartItemId;

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

  const setOptionQty = useCallback((optionId: string, delta: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      const cur = next[optionId] ?? 0;
      const v = Math.max(0, cur + delta);
      if (v === 0) delete next[optionId];
      else next[optionId] = v;
      return next;
    });
    setError(null);
  }, []);

  const selectionsList = useMemo(() => {
    const list: { modifierOptionId: string; quantity: number }[] = [];
    for (const [id, qty] of Object.entries(selections)) {
      if (qty >= 1) list.push({ modifierOptionId: id, quantity: qty });
    }
    return list;
  }, [selections]);

  const totalCents = useMemo(() => {
    let sum = config.priceCents;
    for (const link of config.groups) {
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
  }, [config, selections]);

  const requiredSatisfied = useMemo(() => {
    for (const link of config.groups) {
      if (!link.modifierGroup.isAvailable) continue;
      const total = totalSelectedInGroup(link, selections);
      if (link.required && total < link.minSelections) return false;
      if (total > link.maxSelections) return false;
    }
    for (const link of config.groups) {
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
  }, [config.groups, selections]);

  const canSubmit = requiredSatisfied;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    if (isEditMode && cartItemId) {
      const result = await updateCartItemAction(
        cartId,
        cartItemId,
        editQuantity,
        specialInstructions.trim() || null,
        selectionsList
      );
      setLoading(false);
      if (result?.success) {
        onSuccess();
        onClose();
      } else if (result && !result.success) {
        setError({ message: result.error, code: result.code });
      }
    } else {
      const result = await addToCartAction(
        cartId,
        config.menuItemId,
        1,
        specialInstructions.trim() || null,
        selectionsList
      );
      setLoading(false);
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
            {config.menuItemName}
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
            Base price: ${(config.priceCents / 100).toFixed(2)}
          </p>

          {config.groups
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
                      ({modifierGroupSelectionHint(link.minSelections, link.maxSelections)}
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
}: {
  option: ModifierOptionForUI;
  quantity: number;
  maxForGroup: number;
  totalInGroup: number;
  onIncrease: () => void;
  onDecrease: () => void;
  selections: SelectionState;
  setOptionQty: (id: string, delta: number) => void;
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
                  {nested.name} ({modifierGroupSelectionHint(nested.minSelections, nested.maxSelections)})
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
