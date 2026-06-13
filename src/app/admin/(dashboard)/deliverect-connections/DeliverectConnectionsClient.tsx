"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminApplyChannelRegistrationPayloadToVendor,
  adminDisconnectDeliverectConnection,
  adminManualReconnectDeliverectConnection,
  adminRetryChannelRegistrationMatch,
  adminTriggerDeliverectMenuPull,
} from "@/actions/admin-deliverect-connections.actions";
import type {
  AdminChannelRegistrationRow,
  AdminVendorDeliverectRow,
} from "@/lib/admin-deliverect-connections-types";
import type { DeliverectConnectionOwner } from "@/services/admin-deliverect-connection.service";

type Props = {
  vendors: AdminVendorDeliverectRow[];
  registrations: AdminChannelRegistrationRow[];
};

function ConflictsList({ conflicts }: { conflicts: DeliverectConnectionOwner[] }) {
  if (conflicts.length === 0) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
      {conflicts.map((c) => (
        <li key={c.vendorId}>
          {c.vendorName} ({c.vendorId}) — link {c.deliverectChannelLinkId ?? "—"}, location{" "}
          {c.deliverectLocationId ?? "—"}
        </li>
      ))}
    </ul>
  );
}

export function DeliverectConnectionsClient({ vendors, registrations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<DeliverectConnectionOwner[]>([]);
  const [search, setSearch] = useState("");

  const [reconnectForm, setReconnectForm] = useState({
    targetVendorId: "",
    channelLinkId: "",
    locationId: "",
    accountId: "",
    accountEmail: "",
    forceTransfer: false,
  });

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.vendorId.toLowerCase().includes(q) ||
        (v.deliverectChannelLinkId?.toLowerCase().includes(q) ?? false) ||
        (v.deliverectLocationId?.toLowerCase().includes(q) ?? false)
    );
  }, [search, vendors]);

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string; conflicts?: DeliverectConnectionOwner[] }>) {
    setMessage(null);
    setError(null);
    setConflicts([]);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Action failed.");
        if ("conflicts" in res && res.conflicts) setConflicts(res.conflicts);
        return;
      }
      setMessage(("message" in res && res.message) || "Done.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      {(message || error) && (
        <div className="space-y-2">
          {message ? (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {message}
            </p>
          ) : null}
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
              <p>{error}</p>
              <ConflictsList conflicts={conflicts} />
            </div>
          ) : null}
        </div>
      )}

      <section id="manual-reconnect" className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5">
        <h2 className="text-lg font-semibold text-oo-charcoal">Manual reconnect</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Attach an existing Deliverect channel/location to a vendor. If another vendor owns the link or location,
          enable force transfer to disconnect them first. Does not move menus or webhook history.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Target vendor ID</span>
            <input
              value={reconnectForm.targetVendorId}
              onChange={(e) => setReconnectForm((f) => ({ ...f, targetVendorId: e.target.value }))}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 font-mono text-xs"
              placeholder="cmqbgtnda0000ygqk6g9lfu5j"
              disabled={pending}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Channel link ID</span>
            <input
              value={reconnectForm.channelLinkId}
              onChange={(e) => setReconnectForm((f) => ({ ...f, channelLinkId: e.target.value }))}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 font-mono text-xs"
              placeholder="694c302376b27b4e7266dd23"
              disabled={pending}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Deliverect location ID</span>
            <input
              value={reconnectForm.locationId}
              onChange={(e) => setReconnectForm((f) => ({ ...f, locationId: e.target.value }))}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 font-mono text-xs"
              placeholder="69296696a531758abeeb0701"
              disabled={pending}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Account ID (optional)</span>
            <input
              value={reconnectForm.accountId}
              onChange={(e) => setReconnectForm((f) => ({ ...f, accountId: e.target.value }))}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 font-mono text-xs"
              disabled={pending}
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-oo-charcoal">
          <input
            type="checkbox"
            checked={reconnectForm.forceTransfer}
            onChange={(e) => setReconnectForm((f) => ({ ...f, forceTransfer: e.target.checked }))}
            disabled={pending}
          />
          Force transfer — disconnect any other vendor using this channel link or location
        </label>
        <button
          type="button"
          disabled={pending || !reconnectForm.targetVendorId.trim() || !reconnectForm.channelLinkId.trim()}
          className="mt-4 rounded-lg bg-oo-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          onClick={() =>
            run(() =>
              adminManualReconnectDeliverectConnection({
                targetVendorId: reconnectForm.targetVendorId.trim(),
                channelLinkId: reconnectForm.channelLinkId.trim(),
                locationId: reconnectForm.locationId.trim() || undefined,
                accountId: reconnectForm.accountId.trim() || undefined,
                accountEmail: reconnectForm.accountEmail.trim() || undefined,
                forceTransfer: reconnectForm.forceTransfer,
              })
            )
          }
        >
          Reconnect vendor
        </button>
      </section>

      <section id="vendors">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-oo-charcoal">Vendor connections</h2>
            <p className="mt-1 text-sm text-oo-stone-gray">{vendors.length} vendors</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, id, channel, location…"
            className="w-full max-w-sm rounded border border-oo-light-stone px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-oo-light-stone bg-oo-warm-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-oo-light-stone bg-oo-cream text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">POS status</th>
                <th className="px-3 py-2 font-medium">Channel / location</th>
                <th className="px-3 py-2 font-medium">Menu</th>
                <th className="px-3 py-2 font-medium">Auto-map</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((v) => (
                <tr key={v.vendorId} className="border-b border-oo-light-stone align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-oo-charcoal">{v.name}</p>
                    <p className="font-mono text-[11px] text-oo-stone-gray">{v.vendorId}</p>
                    {v.podName ? <p className="text-xs text-oo-stone-gray">Pod: {v.podName}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>{v.posConnectionStatus}</p>
                    {v.pendingDeliverectConnectionKey ? (
                      <p className="mt-1 font-mono text-[10px] text-amber-900" title={v.pendingDeliverectConnectionKey}>
                        pending key…
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] break-all">
                    <p>link: {v.deliverectChannelLinkId ?? "—"}</p>
                    <p className="mt-1">loc: {v.deliverectLocationId ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-oo-stone-gray">
                    {v.menuSummary.hasPublishedMenuVersion ? "Published menu" : "No published menu"}
                    {v.menuSummary.hasAvailableOperationalItems ? " · items available" : ""}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-oo-stone-gray">
                    {v.deliverectAutoMapLastOutcome ?? "—"}
                    {v.deliverectAutoMapLastDetail ? (
                      <p className="mt-1 break-all">{v.deliverectAutoMapLastDetail}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/admin/vendors/${v.vendorId}/deliverect-mapping`}
                        className="text-xs text-oo-charcoal underline"
                      >
                        Mapping
                      </Link>
                      {v.deliverectChannelLinkId ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-left text-xs text-oo-charcoal underline disabled:opacity-50"
                          onClick={() => run(() => adminTriggerDeliverectMenuPull(v.vendorId))}
                        >
                          Pull menu
                        </button>
                      ) : null}
                      <Link
                        href={`/admin/vendors/${v.vendorId}/menu-history`}
                        className="text-xs text-oo-charcoal underline"
                      >
                        Menu imports
                      </Link>
                      <button
                        type="button"
                        disabled={pending}
                        className="text-left text-xs text-red-700 underline disabled:opacity-50"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Disconnect ${v.name} from Deliverect? Menu and order history are preserved.`
                            )
                          ) {
                            return;
                          }
                          run(() => adminDisconnectDeliverectConnection(v.vendorId));
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="registrations">
        <h2 className="text-lg font-semibold text-oo-charcoal">Stored channel registrations</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Apply reads the stored payload only — no new WebhookEvent rows, no idempotency bypass. Use force transfer when
          reusing a channel already linked elsewhere. Avoid retry match when{" "}
          <code className="text-xs">channelLocationId</code> points at the wrong vendor.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-oo-light-stone bg-oo-warm-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-oo-light-stone bg-oo-cream">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Webhook</th>
                <th className="px-3 py-2 text-left font-medium">Payload</th>
                <th className="px-3 py-2 text-left font-medium">Mapping</th>
                <th className="px-3 py-2 text-left font-medium">Outcome</th>
                <th className="px-3 py-2 text-left font-medium">Apply</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-oo-stone-gray">
                    No channel registration webhooks recorded yet.
                  </td>
                </tr>
              ) : (
                registrations.map((r) => (
                  <RegistrationRow
                    key={r.id}
                    row={r}
                    pending={pending}
                    onApply={(vendorId, forceTransfer) =>
                      run(() => adminApplyChannelRegistrationPayloadToVendor(r.id, vendorId, forceTransfer))
                    }
                    onRetry={() => run(() => adminRetryChannelRegistrationMatch(r.id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RegistrationRow({
  row,
  pending,
  onApply,
  onRetry,
}: {
  row: AdminChannelRegistrationRow;
  pending: boolean;
  onApply: (vendorId: string, forceTransfer: boolean) => void;
  onRetry: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [forceTransfer, setForceTransfer] = useState(false);
  const needsReview =
    row.errorMessage?.startsWith("no_match") || row.errorMessage?.startsWith("ambiguous:");

  return (
    <tr className={`border-b border-oo-light-stone align-top ${needsReview ? "bg-amber-50/40" : ""}`}>
      <td className="px-3 py-2 font-mono text-[11px]">
        <p>{row.createdAtIso}</p>
        <p className="mt-1 break-all" title={row.id}>
          id: {row.id}
        </p>
        {row.eventId ? <p className="mt-1 break-all">{row.eventId}</p> : null}
      </td>
      <td className="px-3 py-2 font-mono text-[11px] break-all">
        <p>link: {row.channelLinkId ?? "—"}</p>
        <p className="mt-1">channelLocationId: {row.channelLocationId ?? "—"}</p>
        <p className="mt-1">locationId: {row.locationId ?? "—"}</p>
      </td>
      <td className="px-3 py-2 text-xs">
        <p>
          Mapped:{" "}
          {row.mappedVendor ? `${row.mappedVendor.vendorName} (${row.mappedVendor.vendorId})` : "—"}
        </p>
        <p className="mt-1">
          Likely: {row.likelyVendor ? `${row.likelyVendor.vendorName} (${row.likelyVendor.vendorId})` : "—"}
        </p>
      </td>
      <td className="px-3 py-2 text-xs text-oo-stone-gray">
        {row.processed ? "processed" : "pending"}
        {row.errorMessage ? <p className="mt-1 break-all">{row.errorMessage}</p> : null}
        {needsReview ? (
          <button
            type="button"
            disabled={pending}
            className="mt-2 text-xs underline disabled:opacity-50"
            onClick={onRetry}
          >
            Retry auto-match
          </button>
        ) : null}
      </td>
      <td className="px-3 py-2">
        {row.channelLinkId ? (
          <div className="flex flex-col gap-1">
            <input
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="Target vendor id"
              className="w-full min-w-[120px] rounded border border-oo-light-stone px-2 py-1 font-mono text-[11px]"
              disabled={pending}
            />
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={forceTransfer}
                onChange={(e) => setForceTransfer(e.target.checked)}
                disabled={pending}
              />
              Force transfer
            </label>
            <button
              type="button"
              disabled={pending || !vendorId.trim()}
              className="rounded border border-stone-400 px-2 py-1 text-xs disabled:opacity-50"
              onClick={() => onApply(vendorId.trim(), forceTransfer)}
            >
              Apply payload
            </button>
          </div>
        ) : (
          <span className="text-xs text-oo-stone-gray">No channelLinkId</span>
        )}
      </td>
    </tr>
  );
}
