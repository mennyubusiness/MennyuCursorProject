"use client";

import { useMemo, useState } from "react";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { customerMenuCategoryDomId } from "@/lib/vendor-menu-category-id";
import {
  filterVendorMenuDisplayItems,
  groupFilteredMenuItemsByCategory,
  type MenuItemFilter,
  type VendorMenuDisplayItem,
} from "@/lib/vendor-menu-page.helpers";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function VendorMenuItemRow({ item }: { item: VendorMenuDisplayItem }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border border-oo-light-stone bg-oo-warm-white p-3 ${!item.isAvailable ? "opacity-80" : ""}`}
    >
      <MenuItemImage
        imageUrl={item.imageUrl}
        itemName={item.name}
        className="h-14 w-14 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium text-oo-charcoal">{item.name}</h3>
          <span className="shrink-0 text-sm font-medium text-oo-charcoal">{formatUsdFromCents(item.priceCents)}</span>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-3 text-sm text-oo-stone-gray">{item.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-oo-cream px-2 py-0.5 text-oo-stone-gray">{item.categoryName}</span>
          {item.isAvailable ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">Available</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-950">Unavailable</span>
          )}
          {item.hasMappingWarning ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-950">Has modifiers</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function VendorMenuItemBrowser({
  items,
  posConnected = false,
}: {
  items: VendorMenuDisplayItem[];
  posConnected?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MenuItemFilter>("all");

  const filtered = useMemo(
    () => filterVendorMenuDisplayItems(items, query, filter),
    [items, query, filter]
  );
  const grouped = useMemo(() => groupFilteredMenuItemsByCategory(filtered), [filtered]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream px-4 py-10 text-center text-sm text-oo-stone-gray">
        <p className="font-medium text-oo-charcoal">No menu items found.</p>
        <p className="mt-2">
          {posConnected
            ? "This menu is managed by your POS. Sync or publish from Deliverect to populate items."
            : "Pull a menu from Deliverect or publish an import to get started."}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-oo-charcoal">Current menu</h3>
        <p className="mt-1 text-sm text-oo-stone-gray">Categories and items customers see right now.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full max-w-md rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["all", "All"],
              ["available", "Available"],
              ["unavailable", "Unavailable"],
              ["warnings", "Warnings"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 font-medium transition ${
                filter === value
                  ? "bg-oo-charcoal text-white"
                  : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-6 text-sm text-oo-stone-gray">
          No menu items found for this filter.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((section) => (
            <section key={section.categoryId} id={customerMenuCategoryDomId(section.categoryId)} className="scroll-mt-4">
              <h4 className="mb-3 text-base font-semibold text-oo-charcoal">{section.categoryName}</h4>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <VendorMenuItemRow item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
