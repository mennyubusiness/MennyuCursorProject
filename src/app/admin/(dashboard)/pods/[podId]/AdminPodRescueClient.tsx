"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AdminInfoRow,
  AdminReasonActionForm,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
import {
  ADMIN_NAV_LABELS,
  buildOrderAdminPath,
  buildPodDashboardPath,
  buildUserAdminPath,
  buildVendorAdminPath,
  buildVendorDashboardPath,
} from "@/lib/admin-entity-nav-links";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { AdminPodDetailView } from "@/services/admin-pod-detail.service";
import {
  adminAddPodOwnerFromPodAction,
  adminAttachVendorToPodFromPodAction,
  adminDetachVendorFromPodFromPodAction,
  adminHidePodAction,
  adminLogPodQrRegeneratedAction,
  adminPausePodOrderingAction,
  adminRecheckPodReadinessAction,
  adminRemovePodOwnerFromPodAction,
  adminSetPodVendorActiveAction,
  adminShowPodAction,
  adminUnpausePodOrderingAction,
  adminUpdatePodPublicProfileAction,
  adminDeletePodProfileAction,
} from "@/actions/admin-pod.actions";
import { AdminEntityDeleteDangerZone } from "@/components/admin/AdminEntityDeleteDangerZone";

type Option = { id: string; name: string };

export function AdminPodRescueClient({
  detail,
  vendorOptions,
}: {
  detail: AdminPodDetailView;
  vendorOptions: Option[];
}) {
  const router = useRouter();
  const podId = detail.pod.id;
  const [name, setName] = useState(detail.pod.name);
  const [description, setDescription] = useState(detail.pod.description ?? "");
  const [address, setAddress] = useState(detail.pod.address ?? "");
  const [contactEmail, setContactEmail] = useState(detail.pod.contactEmail ?? "");
  const [slug, setSlug] = useState(detail.pod.slug);
  const [attachVendorId, setAttachVendorId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [profilePending, startProfileTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    fn().then((r) => {
      if (r.ok) router.refresh();
      return r;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminSection title="Overview">
        <AdminInfoRow label="ID" value={detail.pod.id} />
        <AdminInfoRow
          label="Public URL"
          value={
            <Link href={detail.pod.publicPath} target="_blank" rel="noopener noreferrer" className="underline">
              {detail.pod.publicPath}
            </Link>
          }
        />
        <AdminInfoRow label="Public visibility" value={detail.pod.deletedAt ? "Deleted" : detail.pod.isActive ? "Visible" : "Hidden"} />
        {detail.pod.deletedAt ? (
          <>
            <AdminInfoRow label="Deleted at" value={new Date(detail.pod.deletedAt).toLocaleString()} />
            {detail.pod.deletedByEmail ? (
              <AdminInfoRow label="Deleted by" value={detail.pod.deletedByEmail} />
            ) : null}
          </>
        ) : null}
        <AdminInfoRow label="Ordering" value={detail.pod.mennyuOrdersPaused ? "Paused" : "Open"} />
        <AdminInfoRow label="Readiness" value={detail.readinessLabel} />
        <AdminInfoRow label="Created" value={new Date(detail.pod.createdAt).toLocaleString()} />
        <p>
          <Link href={buildPodDashboardPath(podId)} className="text-sm font-medium underline">
            {ADMIN_NAV_LABELS.openPodDashboard}
          </Link>
        </p>
      </AdminSection>

      <AdminSection title="Ordering controls">
        {detail.pod.mennyuOrdersPaused ? (
          <AdminReasonActionForm
            label="Unpause pod ordering"
            description="Allows all vendors under this pod to accept orders again (subject to vendor-level state)."
            confirmLabel="Unpause pod ordering"
            onSubmit={(reason) => run(() => adminUnpausePodOrderingAction(podId, reason))}
          />
        ) : (
          <AdminReasonActionForm
            label="Pause pod ordering"
            description="Pauses customer ordering for the entire pod. Vendors remain visible unless hidden separately."
            confirmLabel="Pause pod ordering"
            danger
            onSubmit={(reason) => run(() => adminPausePodOrderingAction(podId, reason))}
          />
        )}
        {detail.pod.isActive ? (
          <AdminReasonActionForm
            label="Hide pod publicly"
            description="Removes pod from public discovery and customer pages."
            confirmLabel="Hide pod"
            danger
            onSubmit={(reason) => run(() => adminHidePodAction(podId, reason))}
          />
        ) : (
          <AdminReasonActionForm
            label="Show pod publicly"
            description="Makes pod visible on public pages again."
            confirmLabel="Show pod"
            onSubmit={(reason) => run(() => adminShowPodAction(podId, reason))}
          />
        )}
        <AdminReasonActionForm
          label="Recheck readiness"
          description="Readiness is computed dynamically when pages load."
          confirmLabel="Log readiness recheck"
          onSubmit={(reason) => run(() => adminRecheckPodReadinessAction(podId, reason))}
        />
      </AdminSection>

      <AdminSection title="Public profile">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("pod-profile-reason") as HTMLTextAreaElement).value;
            startProfileTransition(async () => {
              const result = await adminUpdatePodPublicProfileAction({
                podId,
                reason,
                name,
                description,
                address,
                contactEmail,
                slug,
              });
              if (result.ok) router.refresh();
              else alert(result.error);
            });
          }}
        >
          <label className="block text-xs text-oo-stone-gray">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Contact email
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs text-oo-stone-gray">
            Public slug
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm font-mono" />
          </label>
          <textarea name="pod-profile-reason" placeholder="Admin reason" rows={2} required minLength={3} className="w-full rounded border border-oo-light-stone px-2 py-1 text-sm" />
          <button type="submit" disabled={profilePending} className="rounded bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Save profile changes
          </button>
        </form>
        {detail.slugRedirects.length > 0 ? (
          <ul className="text-xs text-oo-stone-gray">
            {detail.slugRedirects.map((r) => (
              <li key={r.id}>
                Redirect: {r.oldSlug} → {r.newSlug}
              </li>
            ))}
          </ul>
        ) : null}
      </AdminSection>

      <AdminSection title="QR / public link">
        <AdminInfoRow label="Canonical URL" value={detail.pod.publicUrl} />
        <AdminInfoRow label="QR destination" value={detail.qr.destinationUrl} />
        <AdminInfoRow label="Matches canonical" value={detail.qr.matchesCanonical ? "Yes" : "No"} />
        {detail.qr.staleWarning ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">{detail.qr.staleWarning}</p>
        ) : null}
        <p className="text-xs text-oo-stone-gray">{detail.qr.note}</p>
        <button
          type="button"
          className="rounded border border-oo-light-stone px-3 py-1.5 text-sm"
          onClick={() => navigator.clipboard.writeText(detail.pod.publicUrl)}
        >
          Copy public URL
        </button>
        <Link href={`/admin/pods/${podId}/qr`} className="ml-2 text-sm underline">
          Open QR page
        </Link>
        <AdminReasonActionForm
          label="Confirm QR destination"
          description="Logs that the current QR should point to the canonical pod URL."
          confirmLabel="Log QR regeneration"
          onSubmit={(reason) =>
            run(() => adminLogPodQrRegeneratedAction({ podId, reason, destinationUrl: detail.qr.destinationUrl }))
          }
        />
      </AdminSection>

      <AdminSection title="Pod owners">
        {detail.owners.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No pod owners.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.owners.map((o) => (
              <li key={o.userId} className="rounded border border-oo-light-stone px-2 py-2">
                <Link href={buildUserAdminPath(o.userId)} className="underline">
                  {ADMIN_NAV_LABELS.openUserAdmin}
                </Link>
                <span className="text-oo-stone-gray"> · {o.email}</span>
                <AdminReasonActionForm
                  label="Remove pod owner access"
                  description="Removes this user's pod membership. Cannot remove the only owner."
                  confirmLabel="Remove access"
                  danger
                  onSubmit={(reason) => run(() => adminRemovePodOwnerFromPodAction({ podId, userId: o.userId, reason }))}
                />
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 space-y-2 rounded border border-dashed border-oo-light-stone p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("owner-reason") as HTMLTextAreaElement).value;
            run(() => adminAddPodOwnerFromPodAction({ podId, userId: ownerUserId.trim(), reason }));
          }}
        >
          <p className="text-xs font-medium">Add pod owner by user ID</p>
          <input
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            placeholder="User ID"
            required
            className="w-full rounded border px-2 py-1 text-sm font-mono"
          />
          <textarea name="owner-reason" rows={2} required minLength={3} placeholder="Admin reason" className="w-full rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
            Add owner access
          </button>
        </form>
      </AdminSection>

      <AdminSection title="Vendor roster">
        {detail.vendors.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No vendors attached.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.vendors.map((v) => (
              <li key={v.vendorId} className="rounded border border-oo-light-stone px-2 py-2">
                <p className="font-medium text-oo-charcoal">{v.vendorName}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link href={buildVendorAdminPath(v.vendorId)} className="underline">
                    {ADMIN_NAV_LABELS.openVendorAdmin}
                  </Link>
                  <Link href={buildVendorDashboardPath(v.vendorId)} className="underline">
                    {ADMIN_NAV_LABELS.openVendorDashboard}
                  </Link>
                  <a
                    href={buildVendorMenuCustomerPath(detail.pod.slug, v.vendorSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {ADMIN_NAV_LABELS.openPublicPage}
                  </a>
                </div>
                <p className="mt-1 text-xs text-oo-stone-gray">{v.orderabilityLabel}</p>
                {v.podVendorActive ? (
                  <AdminReasonActionForm
                    label="Pause vendor in pod"
                    description="Pauses this vendor on this pod's public page."
                    confirmLabel="Pause in pod"
                    onSubmit={(reason) =>
                      run(() => adminSetPodVendorActiveAction({ podId, vendorId: v.vendorId, isActive: false, reason }))
                    }
                  />
                ) : (
                  <AdminReasonActionForm
                    label="Activate vendor in pod"
                    description="Shows vendor as active on this pod again."
                    confirmLabel="Activate in pod"
                    onSubmit={(reason) =>
                      run(() => adminSetPodVendorActiveAction({ podId, vendorId: v.vendorId, isActive: true, reason }))
                    }
                  />
                )}
                <AdminReasonActionForm
                  label="Detach vendor"
                  description="Removes vendor from this pod roster."
                  confirmLabel="Detach"
                  danger
                  onSubmit={(reason) => run(() => adminDetachVendorFromPodFromPodAction({ podId, vendorId: v.vendorId, reason }))}
                />
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 space-y-2 rounded border border-dashed border-oo-light-stone p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("vendor-attach-reason") as HTMLTextAreaElement).value;
            run(() => adminAttachVendorToPodFromPodAction({ podId, vendorId: attachVendorId, reason }));
          }}
        >
          <p className="text-xs font-medium">Attach vendor (admin override)</p>
          <select value={attachVendorId} onChange={(e) => setAttachVendorId(e.target.value)} required className="w-full rounded border px-2 py-1 text-sm">
            <option value="">Select vendor…</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <textarea name="vendor-attach-reason" rows={2} required minLength={3} placeholder="Admin reason" className="w-full rounded border px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
            Attach vendor
          </button>
        </form>
      </AdminSection>

      <AdminSection title="Invites">
        <AdminInfoRow label="Pending" value={detail.invites.pending} />
        <AdminInfoRow label="Accepted" value={detail.invites.accepted} />
        <AdminInfoRow label="Revoked" value={detail.invites.revoked} />
        <AdminInfoRow label="Expired" value={detail.invites.expired} />
        <p className="text-xs text-oo-stone-gray">
          Use <Link href="/admin/users" className="underline">Users</Link> admin tools for invite repair.
        </p>
      </AdminSection>

      <AdminSection title="Recent orders">
        {detail.recentOrders.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No recent orders.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={buildOrderAdminPath(o.id)} className="underline">
                  {ADMIN_NAV_LABELS.openOrderAdmin}
                </Link>
                <span className="text-oo-stone-gray">
                  {" "}
                  · {o.id.slice(0, 8)}… · {o.status} · ${(o.totalCents / 100).toFixed(2)}
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

      <AdminEntityDeleteDangerZone
        title="Delete pod"
        description="The pod will be hidden from public ordering and explore. QR and order links stop accepting new orders. Historical records are preserved."
        confirmLabel="Delete pod"
        confirmationAlternatives={["DELETE", detail.pod.name]}
        deletedAt={detail.pod.deletedAt}
        deletedByEmail={detail.pod.deletedByEmail}
        requireActiveVendorAck={detail.activeVendorCount > 0}
        activeVendorCount={detail.activeVendorCount}
        onSubmit={({ reason, acknowledgeActiveVendors }) =>
          adminDeletePodProfileAction(podId, reason, acknowledgeActiveVendors).then((result) => {
            if (result.ok) router.refresh();
            return result;
          })
        }
      />
    </div>
  );
}
