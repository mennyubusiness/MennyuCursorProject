"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { VendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";
import { formatCentsToCurrency } from "@/lib/menu-price";
import { MenuBuilderItemModifiers } from "./MenuBuilderItemModifiers";
import { MenuBuilderSaveStatus } from "./MenuBuilderSaveStatus";
import { MenuPriceInput } from "./MenuPriceInput";
import { useMenuBuilderEditor } from "./useMenuBuilderEditor";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function VendorMenuBuilderView({ data }: { data: VendorMenuBuilderPageData }) {
  const editor = useMenuBuilderEditor(data);
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
    return map;
  }, [editor.items]);

  const statusReady = editor.validation.ready && editor.hasPublishedMenuVersion;
  const needsPublish = editor.validation.ready && !editor.hasPublishedMenuVersion;

  return (
    <div className="space-y-8">
      <header className="border-b border-oo-light-stone pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-oo-charcoal">Menu Builder</h2>
            <p className="mt-2 max-w-2xl text-sm text-oo-stone-gray">
              Create categories and items for your Open Order storefront. Publish when you are ready
              for customers to order.
            </p>
          </div>
          <MenuBuilderSaveStatus status={editor.globalStatus} />
        </div>
      </header>

      {editor.publishError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {editor.publishError}
        </div>
      ) : null}
      {editor.publishMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {editor.publishMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-oo-charcoal">Menu status</h3>
            <p className="mt-1 text-sm text-oo-stone-gray">
              {statusReady
                ? "Ready — menu is published and valid."
                : needsPublish
                  ? "Valid draft — publish to make it live for customers."
                  : "Needs attention — fix blockers below."}
            </p>
          </div>
          <button
            type="button"
            disabled={editor.publishPending || !editor.validation.ready}
            onClick={() => void editor.publishMenu()}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {editor.publishPending ? "Publishing…" : "Publish menu"}
          </button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-oo-stone-gray">Categories</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {editor.validation.visibleCategoryCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Items</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {editor.validation.visibleItemCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last updated</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {formatDate(editor.lastUpdatedIso)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last published</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {formatDate(editor.publishedAtIso)}
            </dd>
          </div>
        </dl>
        {data.storefrontHref ? (
          <Link
            href={data.storefrontHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-oo-charcoal underline"
          >
            Preview customer menu
          </Link>
        ) : (
          <p className="mt-3 text-sm text-oo-stone-gray">
            Join a pod to get a public menu preview link.
          </p>
        )}
      </section>

      {!editor.validation.ready ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-semibold text-amber-950">Blockers</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {editor.validation.issues.map((issue) => (
              <li key={issue.code}>{issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-oo-charcoal">Categories</h3>
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
            editor.categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                status={editor.getEntityStatus(`cat-name:${cat.id}`)}
                nameError={editor.getEntityError(`cat-name:${cat.id}`)}
                onNameCommit={(name) => editor.updateCategoryName(cat.id, name)}
                onVisibleChange={(isVisible) => editor.updateCategoryVisible(cat.id, isVisible)}
                onDelete={() => editor.removeCategory(cat.id)}
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
              className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm"
            >
              <h4 className="font-medium text-oo-charcoal">
                {cat.name}
                {!cat.isVisible ? (
                  <span className="ml-2 text-xs font-normal text-oo-stone-gray">(hidden)</span>
                ) : null}
              </h4>
              {catItems.length === 0 ? (
                <p className="mt-2 text-sm text-oo-stone-gray">No items in this category.</p>
              ) : (
                <ul className="mt-3 divide-y divide-oo-light-stone">
                  {catItems.map((item) => (
                    <li key={item.id} className="py-3">
                      <ItemRow
                        item={item}
                        vendorId={data.vendorId}
                        editor={editor}
                        nameStatus={editor.getEntityStatus(`item-name:${item.id}`)}
                        nameError={editor.getEntityError(`item-name:${item.id}`)}
                        priceStatus={editor.getEntityStatus(`item-price:${item.id}`)}
                        priceError={editor.getEntityError(`item-price:${item.id}`)}
                        onNameCommit={(name) => editor.updateItemName(item.id, name)}
                        onPriceCommit={(raw) => editor.updateItemPrice(item.id, raw)}
                        onAvailableChange={(isAvailable) =>
                          editor.updateItemAvailable(item.id, isAvailable)
                        }
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
  status,
  nameError,
  onNameCommit,
  onVisibleChange,
  onDelete,
  deleteDisabled,
  deleteStatus,
}: {
  cat: { id: string; name: string; isVisible: boolean; itemCount: number; isTemp?: boolean };
  status: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  nameError: string | null;
  onNameCommit: (name: string) => void;
  onVisibleChange: (isVisible: boolean) => void;
  onDelete: () => void;
  deleteDisabled: boolean;
  deleteStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
}) {
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    setName(cat.name);
  }, [cat.name]);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
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
  nameStatus,
  nameError,
  priceStatus,
  priceError,
  onNameCommit,
  onPriceCommit,
  onAvailableChange,
  onDelete,
  deleteStatus,
}: {
  vendorId: string;
  item: {
    id: string;
    name: string;
    priceCents: number;
    isAvailable: boolean;
    isTemp?: boolean;
    modifierGroups: import("@/lib/vendor-menu-builder-data.server").VendorMenuBuilderModifierGroup[];
  };
  editor: ReturnType<typeof useMenuBuilderEditor>;
  nameStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  nameError: string | null;
  priceStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
  priceError: string | null;
  onNameCommit: (name: string) => void;
  onPriceCommit: (raw: string) => void;
  onAvailableChange: (isAvailable: boolean) => void;
  onDelete: () => void;
  deleteStatus: ReturnType<ReturnType<typeof useMenuBuilderEditor>["getEntityStatus"]>;
}) {
  const [name, setName] = useState(item.name);

  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
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
        {nameStatus === "saving" ? <p className="text-xs text-oo-stone-gray">Saving…</p> : null}
      </div>
      <MenuPriceInput
        cents={item.priceCents}
        compact
        onCommit={onPriceCommit}
        error={priceError}
        status={priceStatus}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.isAvailable}
          onChange={(e) => onAvailableChange(e.target.checked)}
        />
        {item.isAvailable ? "Available" : "Sold out"}
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-oo-stone-gray">{formatCentsToCurrency(item.priceCents)}</span>
        <button
          type="button"
          disabled={deleteStatus === "saving" || item.isTemp}
          onClick={onDelete}
          className="text-red-700 hover:underline disabled:opacity-40"
        >
          {deleteStatus === "saving" ? "Deleting…" : "Delete"}
        </button>
      </div>
      </div>
      <MenuBuilderItemModifiers
        vendorId={vendorId}
        itemId={item.id}
        itemName={item.name}
        groups={item.modifierGroups ?? []}
        editor={editor}
        disabled={item.isTemp}
      />
    </>
  );
}
