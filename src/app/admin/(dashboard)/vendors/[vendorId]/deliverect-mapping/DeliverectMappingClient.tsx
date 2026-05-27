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
  hasActivePosConnection,
  menuItems,
  options,
  stats,
}: {
  vendorId: string;
  deliverectChannelLinkId: string | null;
  /** Vendor-level Deliverect IDs present (channel / location / etc.) */
  hasActivePosConnection: boolean;
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
      <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
          Deliverect mapping coverage
        </h2>
        <p className="mt-2 text-sm text-oo-charcoal">
          <strong>{stats.missingProductId}</strong> of {stats.totalMenuItems} menu items missing{" "}
          <code className="rounded bg-oo-cream px-1 text-xs">deliverectProductId</code>
          {stats.totalMenuItems > 0 && (
            <span className="text-oo-stone-gray">
              {" "}
              ({Math.round((1 - stats.missingProductId / stats.totalMenuItems) * 100)}% mapped)
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-oo-charcoal">
          <strong>{stats.missingModifierId}</strong> of {stats.totalModifierOptions} modifier options
          missing <code className="rounded bg-oo-cream px-1 text-xs">deliverectModifierId</code>
          {stats.totalModifierOptions > 0 && (
            <span className="text-oo-stone-gray">
              {" "}
              ({Math.round((1 - stats.missingModifierId / stats.totalModifierOptions) * 100)}% mapped)
            </span>
          )}
        </p>
        <p className="mt-3 text-xs text-oo-stone-gray">
          Unmapped rows are highlighted. Copy IDs from Deliverect sandbox/POS; Open Order remains the menu
          source of truth — only external IDs are stored here.
        </p>
        {!hasActivePosConnection ? (
          <p className="mt-2 text-sm text-oo-stone-gray">
            No vendor-level Deliverect channel is active — new orders won&apos;t submit to Deliverect until identifiers
            are set again. Menu PLU mappings below are unchanged.
          </p>
        ) : !deliverectChannelLinkId?.trim() ? (
          <p className="mt-2 text-sm text-amber-800">
            Channel link ID is missing — set it before relying on live Deliverect routing.
          </p>
        ) : (
          <p className="mt-2 text-sm text-oo-stone-gray">
            Vendor-level channel link is set. Use mapping tables below for menu payloads.
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
        <h2 className="text-lg font-semibold text-oo-charcoal">Menu items → Deliverect product ID</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Maps to <code className="text-xs">MenuItem.deliverectProductId</code> (used in order payload).
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-oo-light-stone bg-oo-warm-white">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-oo-light-stone bg-oo-cream">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Item</th>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Price</th>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Deliverect product ID</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {menuItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-oo-stone-gray">
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
        <h2 className="text-lg font-semibold text-oo-charcoal">Modifier options → Deliverect modifier ID</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Maps to <code className="text-xs">ModifierOption.deliverectModifierId</code> (per selection in
          payload).
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-oo-light-stone bg-oo-warm-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-oo-light-stone bg-oo-cream">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Group</th>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Option</th>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Price</th>
                <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Deliverect modifier ID</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {options.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-oo-stone-gray">
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

      <p className="text-sm text-oo-stone-gray">
        <Link href="/admin/vendors" className="text-oo-charcoal hover:underline">
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
    <tr className={`border-b border-oo-light-stone ${missing ? "bg-amber-50/60" : ""}`}>
      <td className="px-3 py-2 font-medium text-oo-charcoal">{item.name}</td>
      <td className="px-3 py-2 text-oo-stone-gray">${(item.priceCents / 100).toFixed(2)}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. PLU or Deliverect product _id"
          className="w-full min-w-[200px] rounded border border-oo-light-stone px-2 py-1 font-mono text-xs"
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
          className="rounded bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
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
    <tr className={`border-b border-oo-light-stone ${missing ? "bg-amber-50/60" : ""}`}>
      <td className="px-3 py-2 text-oo-charcoal">{row.groupName}</td>
      <td className="px-3 py-2 font-medium text-oo-charcoal">{row.name}</td>
      <td className="px-3 py-2 text-oo-stone-gray">${(row.priceCents / 100).toFixed(2)}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. modifier PLU / _id"
          className="w-full min-w-[200px] rounded border border-oo-light-stone px-2 py-1 font-mono text-xs"
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
          className="rounded bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
