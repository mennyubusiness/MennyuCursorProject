"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  setMenuItemDeliverectProductId,
  setModifierOptionDeliverectModifierId,
} from "@/actions/admin-deliverect-mapping.actions";

type MenuItemRow = {
  id: string;
  name: string;
  priceCents: number;
  deliverectProductId: string | null;
};

type OptionRow = {
  id: string;
  name: string;
  priceCents: number;
  deliverectModifierId: string | null;
  groupName: string;
};

export function DeliverectMappingClient({
  vendorId,
  deliverectChannelLinkId,
  menuItems,
  options,
  stats,
}: {
  vendorId: string;
  deliverectChannelLinkId: string | null;
  menuItems: MenuItemRow[];
  options: OptionRow[];
  stats: {
    missingProductId: number;
    missingModifierId: number;
    totalMenuItems: number;
    totalModifierOptions: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showMsg = (text: string) => {
    setError(null);
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Deliverect mapping coverage
        </h2>
        <p className="mt-2 text-sm text-stone-700">
          <strong>{stats.missingProductId}</strong> of {stats.totalMenuItems} menu items missing{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">deliverectProductId</code>
          {stats.totalMenuItems > 0 && (
            <span className="text-stone-500">
              {" "}
              ({Math.round((1 - stats.missingProductId / stats.totalMenuItems) * 100)}% mapped)
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-stone-700">
          <strong>{stats.missingModifierId}</strong> of {stats.totalModifierOptions} modifier options
          missing <code className="rounded bg-stone-100 px-1 text-xs">deliverectModifierId</code>
          {stats.totalModifierOptions > 0 && (
            <span className="text-stone-500">
              {" "}
              ({Math.round((1 - stats.missingModifierId / stats.totalModifierOptions) * 100)}% mapped)
            </span>
          )}
        </p>
        <p className="mt-3 text-xs text-stone-500">
          Unmapped rows are highlighted. Copy IDs from Deliverect sandbox/POS; Mennyu remains the menu
          source of truth — only external IDs are stored here.
        </p>
        {!deliverectChannelLinkId && (
          <p className="mt-2 text-sm text-amber-800">
            This vendor has no <code className="text-xs">deliverectChannelLinkId</code> yet — set it in
            the DB or onboarding flow before live routing.
          </p>
        )}
      </div>

      {message && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-stone-900">Menu items → Deliverect product ID</h2>
        <p className="mt-1 text-sm text-stone-600">
          Maps to <code className="text-xs">MenuItem.deliverectProductId</code> (used in order payload).
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Item</th>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Price</th>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Deliverect product ID</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {menuItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-stone-500">
                    No menu items for this vendor.
                  </td>
                </tr>
              ) : (
                menuItems.map((m) => (
                  <MenuItemRowEditor
                    key={`${m.id}-${m.deliverectProductId ?? ""}`}
                    item={m}
                    vendorId={vendorId}
                    pending={pending}
                    startTransition={startTransition}
                    onError={setError}
                    onSuccess={() => {
                      showMsg(`Saved product ID for “${m.name}”.`);
                      router.refresh();
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900">Modifier options → Deliverect modifier ID</h2>
        <p className="mt-1 text-sm text-stone-600">
          Maps to <code className="text-xs">ModifierOption.deliverectModifierId</code> (per selection in
          payload).
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Group</th>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Option</th>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Price</th>
                <th className="px-3 py-2 text-left font-medium text-stone-700">Deliverect modifier ID</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {options.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-stone-500">
                    No modifier options for this vendor.
                  </td>
                </tr>
              ) : (
                options.map((o) => (
                  <ModifierRowEditor
                    key={`${o.id}-${o.deliverectModifierId ?? ""}`}
                    row={o}
                    vendorId={vendorId}
                    pending={pending}
                    startTransition={startTransition}
                    onError={setError}
                    onSuccess={() => {
                      showMsg(`Saved modifier ID for “${o.name}”.`);
                      router.refresh();
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-stone-500">
        <Link href="/admin/vendors" className="text-stone-700 hover:underline">
          ← Back to vendors
        </Link>
      </p>
    </div>
  );
}

function MenuItemRowEditor({
  item,
  vendorId,
  pending,
  startTransition,
  onError,
  onSuccess,
}: {
  item: MenuItemRow;
  vendorId: string;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onError: (s: string | null) => void;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState(item.deliverectProductId ?? "");
  const missing = !item.deliverectProductId?.trim();

  return (
    <tr className={`border-b border-stone-100 ${missing ? "bg-amber-50/60" : ""}`}>
      <td className="px-3 py-2 font-medium text-stone-900">{item.name}</td>
      <td className="px-3 py-2 text-stone-600">${(item.priceCents / 100).toFixed(2)}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. PLU or Deliverect product _id"
          className="w-full min-w-[200px] rounded border border-stone-300 px-2 py-1 font-mono text-xs"
          disabled={pending}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await setMenuItemDeliverectProductId(item.id, vendorId, value);
              if (!r.ok) onError(r.error);
              else {
                onError(null);
                onSuccess();
              }
            });
          }}
          className="rounded bg-stone-800 px-2 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function ModifierRowEditor({
  row,
  vendorId,
  pending,
  startTransition,
  onError,
  onSuccess,
}: {
  row: OptionRow;
  vendorId: string;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onError: (s: string | null) => void;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState(row.deliverectModifierId ?? "");
  const missing = !row.deliverectModifierId?.trim();

  return (
    <tr className={`border-b border-stone-100 ${missing ? "bg-amber-50/60" : ""}`}>
      <td className="px-3 py-2 text-stone-700">{row.groupName}</td>
      <td className="px-3 py-2 font-medium text-stone-900">{row.name}</td>
      <td className="px-3 py-2 text-stone-600">${(row.priceCents / 100).toFixed(2)}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. modifier PLU / _id"
          className="w-full min-w-[200px] rounded border border-stone-300 px-2 py-1 font-mono text-xs"
          disabled={pending}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await setModifierOptionDeliverectModifierId(row.id, vendorId, value);
              if (!r.ok) onError(r.error);
              else {
                onError(null);
                onSuccess();
              }
            });
          }}
          className="rounded bg-stone-800 px-2 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
