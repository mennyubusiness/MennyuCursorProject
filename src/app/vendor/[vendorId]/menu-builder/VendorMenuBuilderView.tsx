"use client";

import { useCallback, useMemo, useState } from "react";
import type { VendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";
import { MenuBuilderDraftPreview } from "./MenuBuilderDraftPreview";
import { MenuBuilderPublishStatus } from "./MenuBuilderPublishStatus";
import { MenuBuilderSaveStatus } from "./MenuBuilderSaveStatus";
import { MenuBuilderSortableCategoryList } from "./MenuBuilderSortableCategoryList";
import { MenuBuilderSortableItemList } from "./MenuBuilderSortableItemList";
import { useMenuBuilderEditor } from "./useMenuBuilderEditor";

export function VendorMenuBuilderView({ data }: { data: VendorMenuBuilderPageData }) {
  const editor = useMenuBuilderEditor(data);
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [modifierExpandedByItemId, setModifierExpandedByItemId] = useState<
    Record<string, boolean | undefined>
  >({});
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: data.categories[0]?.id ?? "",
  });

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, typeof editor.items>();
    for (const item of editor.items) {
      const key = item.categoryId ?? "_none";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => a.sortOrder - b.sortOrder)
      );
    }
    return map;
  }, [editor.items]);

  const modifierValidationByItemId = useMemo(() => {
    const map: Record<string, { hasError: boolean; issueCount: number }> = {};
    for (const item of editor.items) {
      const issues = editor.validation.issues.filter(
        (issue) =>
          issue.code === "INVALID_MODIFIER_GROUP" && issue.message.includes(`"${item.name}"`)
      );
      if (issues.length > 0) {
        map[item.id] = { hasError: true, issueCount: issues.length };
      }
    }
    return map;
  }, [editor.items, editor.validation.issues]);

  const handleModifierExpandedChange = useCallback((itemId: string, expanded: boolean) => {
    setModifierExpandedByItemId((prev) => ({ ...prev, [itemId]: expanded }));
  }, []);

  const scrollToMenuBuilderTarget = (message: string) => {
    for (const item of editor.items) {
      if (message.includes(`"${item.name}"`)) {
        document.getElementById(`menu-builder-item-${item.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        if (
          editor.validation.issues.some(
            (issue) =>
              issue.code === "INVALID_MODIFIER_GROUP" && issue.message === message
          )
        ) {
          handleModifierExpandedChange(item.id, true);
        }
        return;
      }
    }
    for (const cat of editor.categories) {
      if (message.includes(`"${cat.name}"`)) {
        document.getElementById(`menu-builder-category-${cat.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-oo-light-stone pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-oo-charcoal">Menu Builder</h2>
            <p className="mt-2 max-w-2xl text-sm text-oo-stone-gray">
              Edit your draft menu here. Customers order from the published version until you
              publish changes.
            </p>
          </div>
          <MenuBuilderSaveStatus status={editor.globalStatus} />
        </div>
      </header>

      <MenuBuilderPublishStatus
        validation={editor.validation}
        hasPublishedOpenOrderMenu={editor.hasPublishedOpenOrderMenu}
        hasUnpublishedChanges={editor.hasUnpublishedChanges}
        publishedAtIso={editor.publishedAtIso}
        lastUpdatedIso={editor.lastUpdatedIso}
        publishPending={editor.publishPending}
        publishError={editor.publishError}
        publishMessage={editor.publishMessage}
        storefrontHref={data.storefrontHref}
        onPublish={() => void editor.publishMenu()}
        onPreviewDraft={() => setDraftPreviewOpen(true)}
      />

      <MenuBuilderDraftPreview
        open={draftPreviewOpen}
        onClose={() => setDraftPreviewOpen(false)}
        categories={editor.categories}
        items={editor.items}
        vendorName={data.vendorName}
      />

      {!editor.validation.ready ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-semibold text-amber-950">Blockers</h3>
          <p className="mt-1 text-sm text-amber-900">
            Fix these issues before you can publish. Tap an issue to jump to the relevant section.
          </p>
          <ul className="mt-3 space-y-2">
            {editor.validation.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <button
                  type="button"
                  onClick={() => scrollToMenuBuilderTarget(issue.message)}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm text-amber-950 hover:bg-amber-100/60"
                >
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-oo-charcoal">Categories</h3>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Drag categories to reorder. Hidden categories stay in your draft but won&apos;t show to
          customers until visible and published.
        </p>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void editor.addCategory(newCategoryName).then((ok) => {
              if (ok) setNewCategoryName("");
            });
          }}
        >
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name"
            className="min-w-[12rem] flex-1 rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={editor.getEntityStatus("new-category") === "saving"}
            className="rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-warm-white disabled:opacity-50"
          >
            {editor.getEntityStatus("new-category") === "saving" ? "Adding…" : "Add category"}
          </button>
        </form>
        {editor.getEntityError("new-category") ? (
          <p className="mt-2 text-sm text-red-700">{editor.getEntityError("new-category")}</p>
        ) : null}

        <ul className="mt-4 divide-y divide-oo-light-stone">
          <MenuBuilderSortableCategoryList categories={editor.categories} editor={editor} />
        </ul>
      </section>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-oo-charcoal">Add item</h3>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void editor
              .addItem({
                ...newItem,
                categoryId: newItem.categoryId || editor.categories[0]?.id || "",
              })
              .then((ok) => {
                if (ok) {
                  setNewItem({
                    name: "",
                    description: "",
                    price: "",
                    categoryId: editor.categories[0]?.id ?? "",
                  });
                }
              });
          }}
        >
          <input
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
            placeholder="Item name"
            className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            required
          />
          <div>
            <span className="text-xs text-oo-stone-gray">Price</span>
            <div className="mt-1 flex items-center overflow-hidden rounded-lg border border-oo-light-stone bg-white">
              <span className="select-none pl-3 text-sm text-oo-stone-gray">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={newItem.price}
                onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
                placeholder="12"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-3 text-sm outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-oo-stone-gray">Enter dollars, e.g. 12 or 12.50.</p>
          </div>
          <textarea
            value={newItem.description}
            onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
            placeholder="Description (optional)"
            className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm sm:col-span-2"
            rows={2}
          />
          <select
            value={newItem.categoryId}
            onChange={(e) => setNewItem((s) => ({ ...s, categoryId: e.target.value }))}
            className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            required
          >
            <option value="" disabled>
              Select category
            </option>
            {editor.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={
              editor.categories.length === 0 ||
              editor.getEntityStatus("new-item") === "saving"
            }
            className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {editor.getEntityStatus("new-item") === "saving" ? "Adding…" : "Add item"}
          </button>
        </form>
        {editor.getEntityError("new-item") ? (
          <p className="mt-2 text-sm text-red-700">{editor.getEntityError("new-item")}</p>
        ) : null}
      </section>

      <section className="space-y-6">
        <h3 className="text-base font-semibold text-oo-charcoal">Items by category</h3>
        <p className="text-sm text-oo-stone-gray">
          Drag items within each category to reorder. Use the handle on the left of each row.
        </p>
        {editor.categories.map((cat) => {
          const catItems = itemsByCategory.get(cat.id) ?? [];
          return (
            <div
              key={cat.id}
              className="scroll-mt-24 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-oo-light-stone pb-3">
                <h4 className="text-lg font-semibold text-oo-charcoal">
                  {cat.name}
                  {!cat.isVisible ? (
                    <span className="ml-2 text-xs font-normal text-oo-stone-gray">(hidden)</span>
                  ) : null}
                </h4>
                <span className="text-xs text-oo-stone-gray">
                  {catItems.length} item{catItems.length === 1 ? "" : "s"}
                </span>
              </div>
              {catItems.length === 0 ? (
                <p className="mt-3 text-sm text-oo-stone-gray">No items in this category.</p>
              ) : (
                <MenuBuilderSortableItemList
                  categoryId={cat.id}
                  items={catItems}
                  vendorId={data.vendorId}
                  editor={editor}
                  modifierExpanded={modifierExpandedByItemId}
                  onModifierExpandedChange={handleModifierExpandedChange}
                  modifierValidationByItemId={modifierValidationByItemId}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
