"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { ModifierConfigForUI, ModifierOptionForUI } from "./modifier-config";
import { addToCartAction, updateCartItemAction } from "@/actions/cart.actions";
import {
  dispatchCartUpdated,
  type CartUpdateSource,
} from "@/lib/cart-client-sync";
import { useVendorMenuCartOptional } from "@/components/vendor-menu/VendorMenuCartContext";
import type { Cart, CartItemSelection } from "@/domain/types";
import { restoreCartFocus } from "@/lib/cart-focus";
import { getVariantMergedModifierConfigAction } from "@/actions/variant-modifier-config.actions";
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";
import { totalSelectedInGroup, totalSelectedInNested } from "@/lib/modifier-deliverect-variant-steps";
import {
  formatModifierGroupNoteFromClassification,
  classifyMenuItemModifierLink,
  classifyNestedModifierGroup,
} from "@/lib/modifier-group-rules";

const DEBUG_ADD_TO_CART_TRACE = false;

type SelectionState = Record<string, number>;

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
  vendorUsesDeliverect: _vendorUsesDeliverect = false,
  /** From `MenuItem.deliverectVariantParentPlu` — leaf rows use parent shell for variant merge. */
  menuItemDeliverectVariantParentPlu,
  returnFocusMenuItemId,
  cartUpdateSource = "vendor-menu",
}: {
  config: ModifierConfigForUI;
  cartId: string;
  podId?: string;
  vendorId?: string;
  onClose: () => void;
  onSuccess: () => void;
  returnFocusMenuItemId?: string;
  cartItemId?: string;
  quantity?: number;
  initialSelections?: Array<{ modifierOptionId: string; quantity: number }>;
  initialSpecialInstructions?: string | null;
  vendorUsesDeliverect?: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
  cartUpdateSource?: CartUpdateSource;
}) {
  const vendorMenuCart = useVendorMenuCartOptional();
  const isEditMode = !!cartItemId;
  const addSubmitLockRef = useRef(false);

  const commitServerCart = useCallback(
    (next: Cart) => {
      if (vendorMenuCart) {
        vendorMenuCart.applyServerCart(next);
      } else {
        dispatchCartUpdated({ cart: next, source: cartUpdateSource });
      }
    },
    [vendorMenuCart, cartUpdateSource]
  );

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

  const selectionPreview = useMemo((): CartItemSelection[] => {
    const optionById = new Map<string, { name: string; priceCents: number }>();
    for (const link of displayConfig.groups) {
      for (const opt of link.modifierGroup.options) {
        optionById.set(opt.id, { name: opt.name, priceCents: opt.priceCents });
        for (const ng of opt.nestedModifierGroups ?? []) {
          for (const n of ng.options) {
            optionById.set(n.id, { name: n.name, priceCents: n.priceCents });
          }
        }
      }
    }
    return selectionsList
      .map((s) => {
        const opt = optionById.get(s.modifierOptionId);
        if (!opt) return null;
        return {
          modifierOptionId: s.modifierOptionId,
          modifierOptionName: opt.name,
          priceCents: opt.priceCents,
          quantity: s.quantity,
        };
      })
      .filter((s): s is CartItemSelection => s != null);
  }, [displayConfig.groups, selectionsList]);

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

  const variantChildMenuItemCount = displayConfig.variantChildMenuItemCount ?? 0;

  const requiredSatisfied = useMemo(() => {
    for (const link of displayConfig.groups) {
      const classification = classifyMenuItemModifierLink(link, variantChildMenuItemCount);
      const total = totalSelectedInGroup(link, selections);
      if (classification.blocksAddToCartWhenEmpty && total < classification.minSelections) {
        return false;
      }
      if (total > classification.maxSelections) return false;
      if (!classification.isAvailable && classification.required) return false;
    }
    for (const link of displayConfig.groups) {
      for (const opt of link.modifierGroup.options) {
        const qty = selections[opt.id] ?? 0;
        if (qty < 1) continue;
        for (const nested of opt.nestedModifierGroups ?? []) {
          const nestedClass = classifyNestedModifierGroup(nested, 0);
          const nTotal = totalSelectedInNested(nested.options, selections);
          if (nestedClass.blocksAddToCartWhenEmpty && nTotal < nestedClass.minSelections) {
            return false;
          }
          if (nTotal > nestedClass.maxSelections) return false;
          if (!nestedClass.isAvailable && nestedClass.required) return false;
        }
      }
    }
    return true;
  }, [displayConfig.groups, selections, variantChildMenuItemCount]);

  async function submit() {
    if (!requiredSatisfied) {
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] submit skipped (requiredSatisfied=false)");
      }
      return;
    }

    if (!isEditMode) {
      if (addSubmitLockRef.current) return;
      addSubmitLockRef.current = true;
      if (!vendorMenuCart || !vendorId) {
        addSubmitLockRef.current = false;
        setError({ message: "Cart is not available. Refresh and try again." });
        return;
      }
      vendorMenuCart.clearCartMutationError();
      onSuccess();
      if (returnFocusMenuItemId) {
        restoreCartFocus(returnFocusMenuItemId);
      }
      const vendorName =
        vendorMenuCart.cart.groups.find((g) => g.vendorId === vendorId)?.vendorName ?? "Vendor";
      vendorMenuCart.runModifierAddInBackground({
        optimistic: {
          menuItemId: displayConfig.menuItemId,
          vendorId,
          vendorName,
          menuItemName: displayConfig.menuItemName,
          unitPriceCents: displayConfig.priceCents,
          selections: selectionPreview,
        },
        add: () =>
          addToCartAction(
            cartId,
            displayConfig.menuItemId,
            1,
            specialInstructions.trim() || null,
            selectionsList,
            podId
          ),
      });
      return;
    }

    setLoading(true);
    setError(null);
    const cartSnapshot = vendorMenuCart?.cart ?? null;
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
        selectionsList,
        podId
      );
      setLoading(false);
      if (DEBUG_ADD_TO_CART_TRACE) {
        console.log("[ModifierModal] updateCartItemAction returned", { success: result?.success, error: result && !result.success ? result.error : undefined });
      }
      if (result?.success) {
        commitServerCart(result.cart);
        onSuccess();
        onClose();
      } else if (result && !result.success) {
        if (result.cart) {
          commitServerCart(result.cart);
        } else if (cartSnapshot) {
          commitServerCart(cartSnapshot);
        }
        setError({ message: result.error, code: result.code });
      }
      return;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-oo-charcoal/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modifier-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-oo-warm-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-oo-light-stone bg-oo-warm-white px-4 py-3">
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

          {displayConfig.groups
            .filter((link) => {
              const c = classifyMenuItemModifierLink(link, variantChildMenuItemCount);
              return link.modifierGroup.isAvailable || c.required;
            })
            .map((link) => {
              const classification = classifyMenuItemModifierLink(link, variantChildMenuItemCount);
              const total = totalSelectedInGroup(link, selections);
              const requiredMissing =
                classification.uiShowsAsRequired && total < classification.minSelections;
              const unavailableRequired =
                !link.modifierGroup.isAvailable && classification.required;
              return (
                <fieldset key={link.modifierGroup.id} className="rounded-lg border border-stone-200 p-3">
                  <legend className="text-sm font-medium text-stone-900">
                    {link.modifierGroup.name}
                    {classification.uiShowsAsRequired && (
                      <span className="ml-1 text-red-600" aria-hidden>
                        *
                      </span>
                    )}
                    <span className="ml-2 font-normal text-stone-500">
                      {`(${formatModifierGroupNoteFromClassification(classification)})`}
                    </span>
                  </legend>
                  {unavailableRequired && (
                    <p className="mb-2 text-xs text-amber-800" role="status">
                      This required choice is temporarily unavailable. You cannot add this item until it
                      returns.
                    </p>
                  )}
                  {requiredMissing && (
                    <p className="mb-2 text-xs text-red-600" role="alert">
                      Please select at least {classification.minSelections} option(s).
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
                disabled={(isEditMode && loading) || !requiredSatisfied}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {isEditMode && loading ? "Saving…" : isEditMode ? "Save changes" : "Add to cart"}
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
  const canAdd =
    modifierMaxSelectionsIsUnbounded(maxForGroup) || totalInGroup < maxForGroup;
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
            const nestedClass = classifyNestedModifierGroup(nested, 0);
            const nTotal = totalSelectedInNested(nested.options, selections);
            const nRequiredMissing =
              nestedClass.uiShowsAsRequired && nTotal < nestedClass.minSelections;
            if (!nested.isAvailable && !nestedClass.required) return null;
            if (!nested.isAvailable && nestedClass.required) {
              return (
                <fieldset key={nested.id} className="rounded border border-amber-100 bg-amber-50/50 p-2">
                  <legend className="text-xs font-medium text-stone-700">{nested.name}</legend>
                  <p className="text-xs text-amber-800">Required choice unavailable.</p>
                </fieldset>
              );
            }
            return (
              <fieldset key={nested.id} className="rounded border border-stone-100 p-2">
                <legend className="text-xs font-medium text-stone-700">
                  {nested.name}
                  <span className="ml-1.5 font-normal text-stone-500">
                    {`(${formatModifierGroupNoteFromClassification(nestedClass)})`}
                  </span>
                </legend>
                {nRequiredMissing && (
                  <p className="mb-1 text-xs text-red-600">Select at least {nested.minSelections}.</p>
                )}
                <div className="mt-1 space-y-1">
                  {nested.options.map((nopt) => {
                    const canAddNested =
                      modifierMaxSelectionsIsUnbounded(nested.maxSelections) ||
                      nTotal < nested.maxSelections;
                    return (
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
                          disabled={!canAddNested || !nopt.isAvailable}
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
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
