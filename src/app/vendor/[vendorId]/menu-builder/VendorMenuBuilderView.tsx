"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createOpenOrderMenuCategory,
  createOpenOrderMenuItem,
  deleteOpenOrderMenuCategory,
  deleteOpenOrderMenuItem,
  publishOpenOrderMenuAction,
  updateOpenOrderMenuCategory,
  updateOpenOrderMenuItem,
} from "@/actions/vendor-menu-builder.actions";
import type { VendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function VendorMenuBuilderView({ data }: { data: VendorMenuBuilderPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: data.categories[0]?.id ?? "",
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMessage(result.message ?? "Saved.");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  const itemsByCategory = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const key = item.categoryId ?? "_none";
    const list = itemsByCategory.get(key) ?? [];
    list.push(item);
    itemsByCategory.set(key, list);
  }

  const statusReady = data.validation.ready && data.hasPublishedMenuVersion;
  const needsPublish = data.validation.ready && !data.hasPublishedMenuVersion;

  return (
    <div className="space-y-8">
      <header className="border-b border-oo-light-stone pb-6">
        <h2 className="text-2xl font-semibold text-oo-charcoal">Menu Builder</h2>
        <p className="mt-2 max-w-2xl text-sm text-oo-stone-gray">
          Create categories and items for your Open Order storefront. Publish when you are ready for
          customers to order.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
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
            disabled={pending || !data.validation.ready}
            onClick={() => run(() => publishOpenOrderMenuAction(data.vendorId))}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {pending ? "Publishing…" : "Publish menu"}
          </button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-oo-stone-gray">Categories</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{data.validation.visibleCategoryCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Items</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{data.validation.visibleItemCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last updated</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{formatDate(data.lastUpdatedIso)}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last published</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{formatDate(data.publishedAtIso)}</dd>
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
          <p className="mt-3 text-sm text-oo-stone-gray">Join a pod to get a public menu preview link.</p>
        )}
      </section>

      {!data.validation.ready ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-semibold text-amber-950">Blockers</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {data.validation.issues.map((issue) => (
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
            const name = newCategoryName;
            run(async () => {
              const r = await createOpenOrderMenuCategory(data.vendorId, { name });
              if (r.ok) setNewCategoryName("");
              return r;
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
            disabled={pending}
            className="rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-warm-white disabled:opacity-50"
          >
            Add category
          </button>
        </form>

        <ul className="mt-4 divide-y divide-oo-light-stone">
          {data.categories.length === 0 ? (
            <li className="py-3 text-sm text-oo-stone-gray">No categories yet.</li>
          ) : (
            data.categories.map((cat) => (
              <li key={cat.id} className="flex flex-wrap items-center gap-3 py-3">
                <input
                  type="text"
                  defaultValue={cat.name}
                  className="min-w-[10rem] flex-1 rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                  onBlur={(e) => {
                    const name = e.target.value;
                    if (name.trim() === cat.name) return;
                    run(() => updateOpenOrderMenuCategory(data.vendorId, cat.id, { name }));
                  }}
                />
                <label className="flex items-center gap-2 text-sm text-oo-stone-gray">
                  <input
                    type="checkbox"
                    checked={cat.isVisible}
                    onChange={(e) =>
                      run(() =>
                        updateOpenOrderMenuCategory(data.vendorId, cat.id, { isVisible: e.target.checked })
                      )
                    }
                  />
                  Visible
                </label>
                <span className="text-xs text-oo-stone-gray">{cat.itemCount} items</span>
                <button
                  type="button"
                  disabled={pending || cat.itemCount > 0}
                  title={cat.itemCount > 0 ? "Remove items first" : "Delete category"}
                  onClick={() => run(() => deleteOpenOrderMenuCategory(data.vendorId, cat.id))}
                  className="text-sm text-red-700 hover:underline disabled:opacity-40"
                >
                  Delete
                </button>
              </li>
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
            run(async () => {
              const r = await createOpenOrderMenuItem(data.vendorId, newItem);
              if (r.ok) {
                setNewItem({
                  name: "",
                  description: "",
                  price: "",
                  categoryId: data.categories[0]?.id ?? "",
                });
              }
              return r;
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
          <input
            type="text"
            value={newItem.price}
            onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
            placeholder="Price (e.g. 12.50)"
            className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            required
          />
          <textarea
            value={newItem.description}
            onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
            placeholder="Description (optional)"
            className="sm:col-span-2 rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
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
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || data.categories.length === 0}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Add item
          </button>
        </form>
      </section>

      <section className="space-y-6">
        <h3 className="text-base font-semibold text-oo-charcoal">Items by category</h3>
        {data.categories.map((cat) => {
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
                    <li key={item.id} className="grid gap-2 py-3 sm:grid-cols-2 lg:grid-cols-4">
                      <input
                        type="text"
                        defaultValue={item.name}
                        className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                        onBlur={(e) => {
                          if (e.target.value.trim() === item.name) return;
                          run(() =>
                            updateOpenOrderMenuItem(data.vendorId, item.id, { name: e.target.value })
                          );
                        }}
                      />
                      <input
                        type="text"
                        defaultValue={(item.priceCents / 100).toFixed(2)}
                        className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                        onBlur={(e) => {
                          const parsed = Number(e.target.value);
                          if (Math.round(parsed * 100) === item.priceCents) return;
                          run(() =>
                            updateOpenOrderMenuItem(data.vendorId, item.id, { price: e.target.value })
                          );
                        }}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.isAvailable}
                          onChange={(e) =>
                            run(() =>
                              updateOpenOrderMenuItem(data.vendorId, item.id, {
                                isAvailable: e.target.checked,
                              })
                            )
                          }
                        />
                        {item.isAvailable ? "Available" : "Sold out"}
                      </label>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-oo-stone-gray">{formatMoney(item.priceCents)}</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => deleteOpenOrderMenuItem(data.vendorId, item.id))}
                          className="text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
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
