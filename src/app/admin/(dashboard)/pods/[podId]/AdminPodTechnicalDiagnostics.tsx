"use client";

import Link from "next/link";
import {
  AdminInfoRow,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
import type { AdminPodDetailView } from "@/services/admin-pod-detail.service";

/**
 * Level-3 technical diagnostics for admin pods.
 */
export function AdminPodTechnicalDiagnostics({ detail }: { detail: AdminPodDetailView }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title="Identity & raw overview">
          <AdminInfoRow label="Pod ID" value={detail.pod.id} />
          <AdminInfoRow label="Public path" value={detail.pod.publicPath} />
          <AdminInfoRow label="Public URL" value={detail.pod.publicUrl} />
          <AdminInfoRow label="Pickup timezone" value={detail.pod.pickupTimezone ?? "(default)"} />
          <AdminInfoRow label="Onboarding status" value={detail.pod.onboardingStatus} />
          <AdminInfoRow label="Computed readiness label" value={detail.readinessLabel} />
          <AdminInfoRow label="Created" value={new Date(detail.pod.createdAt).toLocaleString()} />
          <AdminInfoRow label="Updated" value={new Date(detail.pod.updatedAt).toLocaleString()} />
          {detail.pod.deletedAt ? (
            <>
              <AdminInfoRow label="Deleted at" value={new Date(detail.pod.deletedAt).toLocaleString()} />
              <AdminInfoRow label="Deleted by user ID" value={detail.pod.deletedByUserId ?? "—"} />
            </>
          ) : null}
        </AdminSection>

        <AdminSection title="QR diagnostics">
          <AdminInfoRow label="QR destination" value={detail.qr.destinationUrl} />
          <AdminInfoRow label="Matches canonical" value={detail.qr.matchesCanonical ? "Yes" : "No"} />
          <AdminInfoRow label="Stale warning" value={detail.qr.staleWarning ?? "None"} />
          <p className="text-xs text-oo-stone-gray">{detail.qr.note}</p>
        </AdminSection>

        <AdminSection title="Ownership IDs">
          {detail.owners.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">No owners.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {detail.owners.map((o) => (
                <li key={o.userId} className="font-mono">
                  {o.userId} · {o.email} · {o.role}
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        <AdminSection title="Slug redirects">
          {detail.slugRedirects.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">No redirects.</p>
          ) : (
            <ul className="space-y-1 text-xs font-mono">
              {detail.slugRedirects.map((r) => (
                <li key={r.id}>
                  {r.id}: {r.oldSlug} → {r.newSlug}
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        <AdminSection title="Invite raw counts">
          <AdminInfoRow label="Pending" value={detail.invites.pending} />
          <AdminInfoRow label="Accepted" value={detail.invites.accepted} />
          <AdminInfoRow label="Revoked" value={detail.invites.revoked} />
          <AdminInfoRow label="Expired" value={detail.invites.expired} />
        </AdminSection>

        <AdminSection title="Vendor attachment raw">
          <AdminInfoRow label="Attached" value={detail.vendors.length} />
          <AdminInfoRow label="Active vendor count (legacy)" value={detail.activeVendorCount} />
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs font-mono">
            {detail.vendors.map((v) => (
              <li key={v.vendorId}>
                {v.vendorId} · podActive={String(v.podVendorActive)} · vendorActive=
                {String(v.vendorActive)} · routing={v.orderRoutingMode}
              </li>
            ))}
          </ul>
        </AdminSection>

        <div className="lg:col-span-2">
          <AdminSection title="Raw audit payloads">
            {detail.auditLogs.length === 0 ? (
              <p className="text-sm text-oo-stone-gray">No audit rows.</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
                {detail.auditLogs.map((log) => (
                  <li key={log.id} className="rounded border border-oo-light-stone px-2 py-1.5 font-mono">
                    <p>{log.actionType}</p>
                    <p className="text-oo-stone-gray">
                      {log.id} · {log.createdAt}
                      {log.adminEmail ? ` · ${log.adminEmail}` : ""}
                    </p>
                    {log.oldValue ? <p>old: {log.oldValue}</p> : null}
                    {log.newValue ? <p>new: {log.newValue}</p> : null}
                    {log.reason ? <p>reason: {log.reason}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>
        </div>
      </div>

      <p className="text-sm">
        <Link href={`/admin/pods/${detail.pod.id}`} className="font-semibold underline">
          Back to pod overview
        </Link>
      </p>
    </div>
  );
}
