"use client";

import { useMemo } from "react";
import { formatCentsToCurrency } from "@/lib/menu-price";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { isModifierGroupEffectivelyRequired } from "@/lib/open-order-modifier-validation";
import type { MenuBuilderCategory, MenuBuilderItem } from "./useMenuBuilderEditor";

type MenuBuilderDraftPreviewProps = {
  open: boolean;
  onClose: () => void;
  categories: MenuBuilderCategory[];
  items: MenuBuilderItem[];
  vendorName: string;
};

export function MenuBuilderDraftPreview({
  open,
  onClose,
  categories,
  items,
  vendorName,
}: MenuBuilderDraftPreviewProps) {
  const sections = useMemo(() => {
    const visibleCategories = categories
      .filter((c) => c.isVisible && c.name.trim())
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return visibleCategories.map((cat) => ({
      ...cat,
      items: items
        .filter((item) => item.categoryId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [categories, items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-preview-title"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-oo-light-stone px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
              Draft preview
            </p>
            <h2 id="draft-preview-title" className="text-xl font-semibold text-oo-charcoal">
              {vendorName}
            </h2>
            <p className="mt-1 text-sm text-oo-stone-gray">
              Read-only preview of your draft menu. Customers cannot order from this preview.
              Publish to make changes live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {sections.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">No visible categories in your draft yet.</p>
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <section key={section.id}>
                  <h3 className="text-lg font-semibold text-oo-charcoal">{section.name}</h3>
                  {section.items.length === 0 ? (
                    <p className="mt-2 text-sm text-oo-stone-gray">No items in this category.</p>
                  ) : (
                    <ul className="mt-3 space-y-4">
                      {section.items.map((item) => (
                        <DraftPreviewItem key={item.id} item={item} />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftPreviewItem({ item }: { item: MenuBuilderItem }) {
  const groups = (item.modifierGroups ?? []).filter((g) => g.isAvailable);

  return (
    <li className="rounded-xl border border-oo-light-stone bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <MenuItemImage
          imageUrl={item.imageUrl}
          itemName={item.name}
          className="h-16 w-16 shrink-0"
          sizes="64px"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-oo-charcoal">{item.name}</h4>
              {item.description ? (
                <p className="mt-1 text-sm text-oo-stone-gray">{item.description}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-base font-bold tabular-nums text-oo-charcoal">
                {formatCentsToCurrency(item.priceCents)}
              </p>
              {!item.isAvailable ? (
                <span className="mt-1 inline-block rounded-md bg-oo-charcoal/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-oo-warm-white">
                  Sold out
                </span>
              ) : (
                <span className="mt-1 inline-block text-xs text-emerald-700">Available</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="mt-3 space-y-3 border-t border-oo-light-stone pt-3">
          {groups.map((group) => {
            const required = isModifierGroupEffectivelyRequired({
              required: group.required,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
            });
            const availableOptions = group.options.filter((o) => o.isAvailable);

            return (
              <div key={group.id}>
                <p className="text-sm font-medium text-oo-charcoal">
                  {group.name}
                  <span className="ml-2 text-xs font-normal text-oo-stone-gray">
                    {required ? "Required" : "Optional"}
                    {group.maxSelections > 1
                      ? ` · Choose up to ${group.maxSelections}`
                      : group.minSelections > 0
                        ? ` · Choose ${group.minSelections}`
                        : ""}
                  </span>
                </p>
                <ul className="mt-1 space-y-1">
                  {group.options.map((option) => (
                    <li
                      key={option.id}
                      className={`flex items-center justify-between text-sm ${
                        option.isAvailable ? "text-oo-charcoal" : "text-oo-stone-gray line-through"
                      }`}
                    >
                      <span>{option.name}</span>
                      <span className="tabular-nums">
                        {option.priceCents > 0
                          ? `+${formatCentsToCurrency(option.priceCents)}`
                          : option.priceCents < 0
                            ? formatCentsToCurrency(option.priceCents)
                            : "Included"}
                      </span>
                    </li>
                  ))}
                </ul>
                {availableOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-800">No available options</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}
