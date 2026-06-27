"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AdminInfoRow,
  AdminReasonActionForm,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
import type { AdminVendorDetailView } from "@/services/admin-vendor-detail.service";
import {
  adminAttachVendorToPodFromVendorAction,
  adminDetachVendorFromPodFromVendorAction,
  adminHideVendorAction,
  adminPauseVendorOrderingAction,
  adminRecheckVendorReadinessAction,
  adminRefreshVendorMenuAction,
  adminRestoreVendorSlugAction,
  adminShowVendorAction,
  adminUnpauseVendorOrderingAction,
  adminUpdateVendorPublicProfileAction,
} from "@/actions/admin-vendor.actions";

type Option = { id: string; name: string };

export function AdminVendorRescueClient({
  detail,
  podOptions,
}: {
  detail: AdminVendorDetailView;
  podOptions: Option[];
}) {
  const router = useRouter();
  const vendorId = detail.vendor.id;
  const [name, setName] = useState(detail.vendor.name);
  const [description, setDescription] = useState(detail.vendor.description ?? "");
  const [contactEmail, setContactEmail] = useState(detail.vendor.contactEmail ?? "");
  const [slug, setSlug] = useState(detail.vendor.slug);
  const [attachPodId, setAttachPodId] = useState("");
  const [profilePending, startProfileTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    fn().then((r) => {
      if (r.ok) router.refresh();
      return r;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminSection title="Overview">
        <AdminInfoRow label="ID" value={detail.vendor.id} />
        <AdminInfoRow label="Public URL" value={detail.vendor.publicPathPreview} />
        <AdminInfoRow label="Public visibility" value={detail.vendor.isActive ? "Visible" : "Hidden"} />
        <AdminInfoRow label="Ordering" value={detail.vendor.mennyuOrdersPaused ? "Paused" : "Open"} />
        <AdminInfoRow label="Readiness" value={detail.readinessSummary.label} />
        <AdminInfoRow label="Onboarding" value={detail.vendor.onboardingStatus} />
        <AdminInfoRow label="Created" value={new Date(detail.vendor.createdAt).toLocaleString()} />
      </AdminSection>

      <AdminSection title="Ordering controls">
        {detail.vendor.mennyuOrdersPaused ? (
          <AdminReasonActionForm
            label="Unpause vendor ordering"
            description="Allows customers to place new orders again."
            confirmLabel="Unpause ordering"
            onSubmit={(reason) => run(() => adminUnpauseVendorOrderingAction(vendorId, reason))}
          />
        ) : (
          <AdminReasonActionForm
            label="Pause vendor ordering"
            description="Stops new customer orders immediately. Does not delete menu or order history."
            confirmLabel="Pause ordering"
            danger
            onSubmit={(reason) => run(() => adminPauseVendorOrderingAction(vendorId, reason))}
          />
        )}
        {detail.vendor.isActive ? (
          <AdminReasonActionForm
            label="Hide vendor publicly"
            description="Removes vendor from public pod pages and menus."
            confirmLabel="Hide vendor"
            danger
            onSubmit={(reason) => run(() => adminHideVendorAction(vendorId, reason))}
          />
        ) : (
          <AdminReasonActionForm
            label="Show vendor publicly"
            description="Makes vendor visible on public pod pages again."
            confirmLabel="Show vendor"
            onSubmit={(reason) => run(() => adminShowVendorAction(vendorId, reason))}
          />
        )}
        <AdminReasonActionForm
          label="Recheck readiness"
          description="Readiness is computed dynamically when pages load."
          confirmLabel="Log readiness recheck"
          onSubmit={(reason) => run(() => adminRecheckVendorReadinessAction(vendorId, reason))}
        />
      </AdminSection>

      <AdminSection title="Public profile">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("profile-reason") as HTMLTextAreaElement).value;
            startProfileTransition(async () => {
              const result = await adminUpdateVendorPublicProfileAction({
                vendorId,
                reason,
                name,
                description,
                contactEmail,
                slug,
              });
              if (result.ok) router.refresh();
              else alert(result.error);
            });
          }}
        >
          <label className="block text-xs text-oo-stone-gray">
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Contact email
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Public slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm font-mono" />
          </label>
          <p className="text-xs text-oo-stone-gray">Preview: {detail.vendor.publicPathPreview.replace(detail.vendor.slug, slug || detail.vendor.slug)}</p>
          <textarea name="profile-reason" placeholder="Admin reason" rows={2} required minLength={3} className="w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          <button type="submit" disabled={profilePending} className="rounded bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Save profile changes
          </button>
        </form>
        {detail.slugRedirects.length > 0 ? (
          <div className="text-xs text-oo-stone-gray">
            <p className="font-medium text-oo-charcoal">Previous slug redirects</p>
            <ul className="mt-1 space-y-1">
              {detail.slugRedirects.map((r) => (
                <li key={r.id}>
                  {r.oldSlug} → {r.newSlug}
                </li>
              ))}
            </ul>
            {detail.slugRedirects[0] ? (
              <AdminReasonActionForm
                label={`Restore slug ${detail.slugRedirects[0].oldSlug}`}
                description="Restores a previous slug if no collision exists."
                confirmLabel="Restore previous slug"
                onSubmit={(reason) =>
                  run(() => adminRestoreVendorSlugAction(vendorId, detail.slugRedirects[0]!.oldSlug, reason))
                }
              />
            ) : null}
          </div>
        ) : null}
      </AdminSection>

      <AdminSection title="Access">
        {detail.owners.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No linked users.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.owners.map((o) => (
              <li key={o.userId}>
                <Link href={`/admin/users/${o.userId}`} className="underline">
                  {o.email}
                </Link>
                <span className="text-oo-stone-gray"> · {o.role}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Pod membership">
        {detail.pods.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">Not attached to any pod.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.pods.map((p) => (
              <li key={p.podId} className="rounded border border-oo-light-stone px-2 py-2">
                <Link href={`/admin/pods/${p.podId}`} className="font-medium underline">
                  {p.podName}
                </Link>
                <p className="text-xs text-oo-stone-gray">
                  {p.publicPath} · {p.podVendorActive ? "Active in pod" : "Paused in pod"}
                </p>
                <AdminReasonActionForm
                  label="Detach from pod"
                  description={`Admin override: remove vendor from ${p.podName}.`}
                  confirmLabel="Detach"
                  danger
                  onSubmit={(reason) =>
                    run(() => adminDetachVendorFromPodFromVendorAction({ vendorId, podId: p.podId, reason }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 space-y-2 rounded border border-dashed border-oo-light-stone p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("attach-reason") as HTMLTextAreaElement).value;
            run(() => adminAttachVendorToPodFromVendorAction({ vendorId, podId: attachPodId, reason }));
          }}
        >
          <p className="text-xs font-medium">Attach/move to pod (admin override)</p>
          <select value={attachPodId} onChange={(e) => setAttachPodId(e.target.value)} required className="w-full rounded border px-2 py-1 text-sm">
            <option value="">Select pod…</option>
            {podOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <textarea name="attach-reason" rows={2} required minLength={3} placeholder="Admin reason" className="w-full rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
            Attach to pod
          </button>
        </form>
      </AdminSection>

      <AdminSection title="Menu / POS status">
        <AdminInfoRow label="POS status" value={detail.vendor.posConnectionStatus} />
        <AdminInfoRow label="POS provider" value={detail.vendor.posProvider ?? "—"} />
        <AdminInfoRow label="Deliverect channel" value={detail.vendor.deliverectChannelLinkId ?? "—"} />
        <AdminInfoRow label="Deliverect location" value={detail.vendor.deliverectLocationId ?? "—"} />
        <AdminInfoRow label="Menu items" value={`${detail.menuSync.totalItems} total · ${detail.menuSync.visibleItems} visible · ${detail.menuSync.unavailableItems} unavailable`} />
        <AdminInfoRow label="Last successful sync" value={detail.menuSync.lastSuccessAt ? new Date(detail.menuSync.lastSuccessAt).toLocaleString() : "—"} />
        <AdminInfoRow label="Last failed sync" value={detail.menuSync.lastFailedAt ? new Date(detail.menuSync.lastFailedAt).toLocaleString() : "—"} />
        <AdminReasonActionForm
          label="Refresh menu from POS/Deliverect"
          description="Triggers the existing Deliverect menu pull. Requires a channel link."
          confirmLabel="Refresh menu"
          disabled={!detail.menuSync.refreshConfigured}
          disabledReason="Menu refresh is not configured yet."
          onSubmit={(reason) => run(() => adminRefreshVendorMenuAction(vendorId, reason))}
        />
      </AdminSection>

      <AdminSection title="Stripe / setup">
        <AdminInfoRow label="Connect account" value={detail.vendor.stripeConnectedAccountId ?? "Not connected"} />
        <AdminInfoRow label="Details submitted" value={detail.vendor.stripeDetailsSubmitted ? "Yes" : "No"} />
        <AdminInfoRow label="Charges enabled" value={detail.vendor.stripeChargesEnabled ? "Yes" : "No"} />
        <AdminInfoRow label="Payouts enabled" value={detail.vendor.stripePayoutsEnabled ? "Yes" : "No"} />
      </AdminSection>

      <AdminSection title="Recent orders">
        {detail.recentOrders.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No recent orders.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="underline">
                  {o.id.slice(0, 8)}…
                </Link>
                <span className="text-oo-stone-gray">
                  {" "}
                  · {o.routingStatus}/{o.fulfillmentStatus} · ${(o.totalCents / 100).toFixed(2)} · {new Date(o.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Audit log">
        {detail.auditLogs.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No admin actions logged yet.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
            {detail.auditLogs.map((log) => (
              <li key={log.id} className="rounded border border-oo-light-stone px-2 py-1.5">
                <p className="font-medium">{log.actionType}</p>
                <p className="text-oo-stone-gray">
                  {new Date(log.createdAt).toLocaleString()}
                  {log.adminEmail ? ` · ${log.adminEmail}` : ""}
                </p>
                {log.reason ? <p className="text-oo-stone-gray">Reason: {log.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
