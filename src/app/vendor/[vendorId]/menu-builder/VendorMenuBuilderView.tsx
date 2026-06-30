"use client";

import { useEffect, useMemo, useState } from "react";
import type { VendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";
import { MenuBuilderDraftPreview } from "./MenuBuilderDraftPreview";
import { MenuBuilderItemModifiers } from "./MenuBuilderItemModifiers";
import { MenuBuilderItemPhoto } from "./MenuBuilderItemPhoto";
import { MenuBuilderPublishStatus } from "./MenuBuilderPublishStatus";
import { MenuBuilderReorderButtons } from "./MenuBuilderReorderButtons";
import { MenuBuilderSaveStatus } from "./MenuBuilderSaveStatus";
import { MenuPriceInput } from "./MenuPriceInput";
import { useMenuBuilderEditor } from "./useMenuBuilderEditor";

export function VendorMenuBuilderView({ data }: { data: VendorMenuBuilderPageData }) {
  const editor = useMenuBuilderEditor(data);
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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

  const scrollToMenuBuilderTarget = (message: string) => {
    for (const item of editor.items) {
      if (message.includes(`"${item.name}"`)) {
        document.getElementById(`menu-builder-item-${item.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
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
          Drag order with the arrows. Hidden categories stay in your draft but won&apos;t show to
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
          {editor.categories.length === 0 ? (
            <li className="py-3 text-sm text-oo-stone-gray">No categories yet.</li>
          ) : (
            editor.categories.map((cat, catIndex) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                catIndex={catIndex}
                catCount={editor.categories.length}
                status={editor.getEntityStatus(`cat-name:${cat.id}`)}
                nameError={editor.getEntityError(`cat-name:${cat.id}`)}
                reorderStatus={editor.getEntityStatus("category-reorder")}
                onNameCommit={(name) => editor.updateCategoryName(cat.id, name)}
                onVisibleChange={(isVisible) => editor.updateCategoryVisible(cat.id, isVisible)}
                onDelete={() => editor.removeCategory(cat.id)}
                onMoveUp={() => editor.moveCategory(cat.id, "up")}
                onMoveDown={() => editor.moveCategory(cat.id, "down")}
                deleteDisabled={cat.itemCount > 0}
                deleteStatus={editor.getEntityStatus(`cat-delete:${cat.id}`)}
              />
            ))
          )}
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
                <ul className="mt-3 space-y-4">
                  {catItems.map((item, itemIndex) => (
                    <li
                      key={item.id}
                      id={`menu-builder-item-${item.id}`}
                      className="scroll-mt-24 rounded-xl border border-oo-light-stone bg-white p-4 shadow-sm"
                    >
                      <ItemRow
                        item={item}
                        vendorId={data.vendorId}
                        editor={editor}
                        itemIndex={itemIndex}
                        itemCount={catItems.length}
                        nameStatus={editor.getEntityStatus(`item-name:${item.id}`)}
                        nameError={editor.getEntityError(`item-name:${item.id}`)}
                        priceStatus={editor.getEntityStatus(`item-price:${item.id}`)}
                        priceError={editor.getEntityError(`item-price:${item.id}`)}
                        imageStatus={editor.getEntityStatus(`item-image:${item.id}`)}
                        imageError={editor.getEntityError(`item-image:${item.id}`)}
                        reorderStatus={editor.getEntityStatus(`item-reorder:${cat.id}`)}
                        onNameCommit={(name) => editor.updateItemName(item.id, name)}
                        onPriceCommit={(raw) => editor.updateItemPrice(item.id, raw)}
                        onAvailableChange={(isAvailable) =>
                          editor.updateItemAvailable(item.id, isAvailable)
                        }
                        onImageChange={(url) => editor.updateItemImage(item.id, url)}
                        onMoveUp={() => editor.moveItemInCategory(cat.id, item.id, "up")}
                        onMoveDown={() => editor.moveItemInCategory(cat.id, item.id, "down")}
                        onDelete={() => editor.removeItem(item.id)}
                        deleteStatus={editor.getEntityStatus(`item-delete:${item.id}`)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CategoryRow({
  cat,
  catIndex,
  catCount,
  status,
  nameError,
  reorderStatus,
  onNameCommit,
  onVisibleChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  deleteDisabled,
  deleteStatus,
}: {
  cat: { id: string; name: string; isVisible: boolean; itemCount: number; isTemp?: boolean };
  catIndex: number;
  catCount: number;
  status: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  nameError: string | null;
  reorderStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  onNameCommit: (name: string) => void;
  onVisibleChange: (isVisible: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  deleteDisabled: boolean;
  deleteStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
}) {
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    setName(cat.name);
  }, [cat.name]);

  return (
    <li
      id={`menu-builder-category-${cat.id}`}
      className="scroll-mt-24 flex flex-wrap items-center gap-3 py-3"
    >
      <MenuBuilderReorderButtons
        label={cat.name}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={catIndex > 0}
        canMoveDown={catIndex < catCount - 1}
        disabled={cat.isTemp || reorderStatus === "saving"}
      />
      <div className="min-w-[10rem] flex-1 space-y-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed !== cat.name) onNameCommit(trimmed);
          }}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            nameError ? "border-red-300" : "border-oo-light-stone"
          }`}
        />
        {nameError ? <p className="text-xs text-red-700">{nameError}</p> : null}
        {status === "saving" ? <p className="text-xs text-oo-stone-gray">Saving…</p> : null}
      </div>
      <label className="flex items-center gap-2 text-sm text-oo-stone-gray">
        <input
          type="checkbox"
          checked={cat.isVisible}
          onChange={(e) => onVisibleChange(e.target.checked)}
        />
        Visible
      </label>
      <span className="text-xs text-oo-stone-gray">{cat.itemCount} items</span>
      <button
        type="button"
        disabled={deleteDisabled || deleteStatus === "saving" || cat.isTemp}
        title={deleteDisabled ? "Remove items first" : "Delete category"}
        onClick={onDelete}
        className="text-sm text-red-700 hover:underline disabled:opacity-40"
      >
        {deleteStatus === "saving" ? "Deleting…" : "Delete"}
      </button>
    </li>
  );
}

function ItemRow({
  vendorId,
  item,
  editor,
  itemIndex,
  itemCount,
  nameStatus,
  nameError,
  priceStatus,
  priceError,
  imageStatus,
  imageError,
  reorderStatus,
  onNameCommit,
  onPriceCommit,
  onAvailableChange,
  onImageChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  deleteStatus,
}: {
  vendorId: string;
  item: {
    id: string;
    name: string;
    priceCents: number;
    isAvailable: boolean;
    imageUrl: string | null;
    isTemp?: boolean;
    modifierGroups: import("@/lib/vendor-menu-builder-data.server").VendorMenuBuilderModifierGroup[];
  };
  editor: ReturnType<typeof useMenuBuilderEditor>;
  itemIndex: number;
  itemCount: number;
  nameStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  nameError: string | null;
  priceStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  priceError: string | null;
  imageStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  imageError: string | null;
  reorderStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  onNameCommit: (name: string) => void;
  onPriceCommit: (raw: string) => void;
  onAvailableChange: (isAvailable: boolean) => void;
  onImageChange: (url: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  deleteStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
}) {
  const [name, setName] = useState(item.name);

  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <MenuBuilderReorderButtons
          label={item.name}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={itemIndex > 0}
          canMoveDown={itemIndex < itemCount - 1}
          disabled={item.isTemp || reorderStatus === "saving"}
        />
        <MenuBuilderItemPhoto
          vendorId={vendorId}
          itemId={item.id}
          itemName={item.name}
          imageUrl={item.imageUrl}
          disabled={item.isTemp}
          onImageChange={onImageChange}
          status={imageStatus}
          error={imageError}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-oo-stone-gray">Item name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  const trimmed = name.trim();
                  if (trimmed !== item.name) onNameCommit(trimmed);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  nameError ? "border-red-300" : "border-oo-light-stone"
                }`}
              />
              {nameError ? <p className="text-xs text-red-700">{nameError}</p> : null}
              {nameStatus === "saving" ? (
                <p className="text-xs text-oo-stone-gray">Saving…</p>
              ) : null}
            </div>
            <div>
              <MenuPriceInput
                cents={item.priceCents}
                compact
                onCommit={onPriceCommit}
                error={priceError}
                status={priceStatus}
              />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  onChange={(e) => onAvailableChange(e.target.checked)}
                />
                {item.isAvailable ? "Available" : "Sold out"}
              </label>
              <button
                type="button"
                disabled={deleteStatus === "saving" || item.isTemp}
                onClick={onDelete}
                className="text-sm text-red-700 hover:underline disabled:opacity-40"
              >
                {deleteStatus === "saving" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Modifiers & options
        </p>
        <div className="mt-2">
      <MenuBuilderItemModifiers
        vendorId={vendorId}
        itemId={item.id}
        itemName={item.name}
        groups={item.modifierGroups ?? []}
        editor={editor}
        disabled={item.isTemp}
      />
        </div>
      </div>
    </>
  );
}
