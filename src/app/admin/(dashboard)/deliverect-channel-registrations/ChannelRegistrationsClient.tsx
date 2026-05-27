"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  adminApplyChannelRegistrationPayloadToVendor,
  adminRetryChannelRegistrationMatch,
} from "@/actions/admin-deliverect-channel-registration.actions";

export type ChannelRegistrationRow = {
  id: string;
  createdAtIso: string;
  eventId: string | null;
  processed: boolean;
  errorMessage: string | null;
  payloadKeys: string[];
  channelLinkId: string | null;
  channelLocationId: string | null;
  locationId: string | null;
  status: string | null;
  channelLinkName: string | null;
};

export function ChannelRegistrationsClient({ rows }: { rows: ChannelRegistrationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-oo-light-stone bg-oo-warm-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-oo-light-stone bg-oo-cream">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Time (UTC)</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">channelLinkId</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">channelLocationId</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">locationId</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Outcome</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Retry match</th>
              <th className="px-3 py-2 text-left font-medium text-oo-charcoal">Attach to vendor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-oo-stone-gray">
                  No channel registration webhooks recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const needsReview =
                  r.errorMessage?.startsWith("no_match") || r.errorMessage?.startsWith("ambiguous:");
                const canRetry =
                  Boolean(r.channelLinkId) &&
                  Boolean(r.errorMessage) &&
                  (r.errorMessage?.startsWith("no_match") || r.errorMessage?.startsWith("ambiguous:"));
                return (
                  <tr key={r.id} className={`border-b border-oo-light-stone ${needsReview ? "bg-amber-50/50" : ""}`}>
                    <td className="px-3 py-2 align-top font-mono text-xs text-oo-charcoal">{r.createdAtIso}</td>
                    <td className="px-3 py-2 align-top font-mono text-xs break-all">{r.channelLinkId ?? "—"}</td>
                    <td className="px-3 py-2 align-top font-mono text-xs break-all">{r.channelLocationId ?? "—"}</td>
                    <td className="px-3 py-2 align-top font-mono text-xs break-all">{r.locationId ?? "—"}</td>
                    <td className="px-3 py-2 align-top text-xs text-oo-stone-gray">
                      <span className="font-medium">{r.processed ? "processed" : "pending"}</span>
                      {r.errorMessage ? (
                        <span className="mt-1 block text-oo-stone-gray" title={r.errorMessage}>
                          {r.errorMessage.length > 120 ? `${r.errorMessage.slice(0, 120)}…` : r.errorMessage}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[10px] text-oo-stone-gray">keys: {r.payloadKeys.join(", ") || "—"}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {canRetry ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-amber-600/40 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                          onClick={() => {
                            setMessage(null);
                            setError(null);
                            startTransition(async () => {
                              const res = await adminRetryChannelRegistrationMatch(r.id);
                              if (!res.ok) {
                                setError(res.error);
                                return;
                              }
                              if (res.outcome === "still_no_match") {
                                setMessage("Retry completed — still no automatic match. Fix channelLocationId / vendor data and retry again, or apply manually.");
                              } else if (String(res.outcome).startsWith("ambiguous")) {
                                setMessage(`Still ambiguous: ${res.outcome}`);
                              } else {
                                setMessage(
                                  `Matched — vendor ${res.vendorId ?? ""} channelLinkId ${res.channelLinkId ?? ""}`
                                );
                              }
                              router.refresh();
                            });
                          }}
                        >
                          Retry match
                        </button>
                      ) : (
                        <span className="text-xs text-oo-stone-gray">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.channelLinkId ? (
                        <AttachForm
                          disabled={pending}
                          onSubmit={(vendorId) => {
                            setMessage(null);
                            setError(null);
                            startTransition(async () => {
                              const res = await adminApplyChannelRegistrationPayloadToVendor(r.id, vendorId);
                              if (!res.ok) {
                                setError(res.error);
                                return;
                              }
                              setMessage(
                                `Applied to vendor ${res.vendorId} (${res.outcome}) — channelLinkId ${res.channelLinkId}`
                              );
                              router.refresh();
                            });
                          }}
                        />
                      ) : (
                        <span className="text-xs text-oo-stone-gray">No channelLinkId in payload</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-oo-stone-gray">
        Automatic matching uses email → correlation key → <strong>channelLocationId = Open Order location ID (Vendor.id)</strong>{" "}
        → Deliverect portal <strong>locationId</strong> = <code className="text-[11px]">Vendor.deliverectLocationId</code> →
        account id. If Deliverect sends only standard fields, configure <strong>channelLocationId</strong> in Deliverect to the
        restaurant&apos;s Open Order location ID from the vendor Connect POS screen.
      </p>
      <p className="text-sm text-oo-stone-gray">
        <Link href="/admin/deliverect-webhook-incidents" className="text-oo-charcoal underline hover:text-stone-950">
          Order-status webhook incidents
        </Link>
      </p>
    </div>
  );
}

function AttachForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (vendorId: string) => void;
}) {
  const [vendorId, setVendorId] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <input
        value={vendorId}
        onChange={(e) => setVendorId(e.target.value)}
        placeholder="Vendor id (cuid)"
        className="w-full min-w-[140px] rounded border border-oo-light-stone px-2 py-1 font-mono text-xs"
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={disabled || !vendorId.trim()}
        className="rounded border border-stone-400 bg-oo-warm-white px-2 py-1 text-xs font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
        onClick={() => onSubmit(vendorId.trim())}
      >
        Apply payload
      </button>
    </div>
  );
}
