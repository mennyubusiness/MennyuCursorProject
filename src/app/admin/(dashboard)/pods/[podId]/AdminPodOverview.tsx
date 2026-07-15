"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AdminAttentionSection,
  AdminQuickActionButton,
  AdminStatusBadge,
  AdminStatusCard,
} from "@/components/admin/AdminDetailUi";
import { AdminEntityDeleteDangerZone } from "@/components/admin/AdminEntityDeleteDangerZone";
import {
  AdminReasonActionForm,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
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
import {
  ADMIN_NAV_LABELS,
  buildOrderAdminPath,
  buildUserAdminPath,
  buildVendorAdminPath,
  buildVendorDashboardPath,
} from "@/lib/admin-entity-nav-links";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { formatAdminMoney, formatAdminOrderDate } from "@/lib/admin-order-detail-ui";
import type { AdminPodSummary, AdminPodVendorRow } from "@/lib/admin-pod-summary";
import {
  adminPodPrimaryOrderState,
  formatAdminAuditActionLabel,
} from "@/lib/admin-pod-summary";
import type { AdminPodDetailView } from "@/services/admin-pod-detail.service";

type Option = { id: string; name: string };

type VendorFilter = "all" | "open" | "needs_attention" | "hidden";

function filterVendorRows(rows: AdminPodVendorRow[], filter: VendorFilter): AdminPodVendorRow[] {
  switch (filter) {
    case "open":
      return rows.filter((row) => row.statusKey === "accepting_orders");
    case "needs_attention":
      return rows.filter((row) =>
        row.statusKey === "paused" ||
        row.statusKey === "setup_required" ||
        row.statusKey === "routing_issue"
      );
    case "hidden":
      return rows.filter((row) => row.statusKey === "hidden");
    default:
      return rows;
  }
}

export function AdminPodOverview({
  summary,
  detail,
  vendorOptions,
}: {
  summary: AdminPodSummary;
  detail: AdminPodDetailView;
  vendorOptions: Option[];
}) {
  const router = useRouter();
  const podId = detail.pod.id;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vendorFilter, setVendorFilter] = useState<VendorFilter>("all");
  const [name, setName] = useState(detail.pod.name);
  const [description, setDescription] = useState(detail.pod.description ?? "");
  const [address, setAddress] = useState(detail.pod.address ?? "");
  const [contactEmail, setContactEmail] = useState(detail.pod.contactEmail ?? "");
  const [slug, setSlug] = useState(detail.pod.slug);
  const [attachVendorId, setAttachVendorId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [profilePending, startProfileTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    fn().then((result) => {
      if (result.ok) router.refresh();
      return result;
    });

  const recentOrders = detail.recentOrders.slice(0, 5);
  const recentActivity = detail.auditLogs.slice(0, 8);

  const attentionItems = useMemo(
    () =>
      summary.attentionItems.map((item) => ({
        ...item,
        onActionClick:
          item.actionHref === "#advanced-settings" ? () => setShowAdvanced(true) : undefined,
      })),
    [summary.attentionItems]
  );

  const filteredVendorRows = filterVendorRows(summary.vendorRows, vendorFilter);

  const vendorFilterTabs: Array<{ key: VendorFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: summary.vendors.totalAttached },
    { key: "open", label: "Open", count: summary.vendors.open },
    { key: "needs_attention", label: "Needs attention", count: summary.vendors.needsAttention },
    { key: "hidden", label: "Hidden", count: summary.vendors.hidden },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{summary.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-oo-stone-gray">
              <span>/{summary.slug}</span>
              {summary.locationLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{summary.locationLabel}</span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <AdminStatusBadge label={summary.overallStatus.label} tone={summary.overallStatus.tone} />
              {summary.secondaryBadge ? (
                <AdminStatusBadge label={summary.secondaryBadge.label} tone="neutral" />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={summary.links.podDashboard}
              className="inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Open pod dashboard
            </Link>
            <a
              href={summary.links.publicPage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              View public page
            </a>
            <button
              type="button"
              className="inline-flex rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
              onClick={() => {
                setShowAdvanced(true);
                document.getElementById("advanced-settings")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Edit profile
            </button>
            <details className="relative">
              <summary className="list-none cursor-pointer rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream [&::-webkit-details-marker]:hidden">
                More
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-[12rem] rounded-lg border border-oo-light-stone bg-white p-2 text-sm shadow-lg">
                <Link href={summary.links.diagnostics} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                  Technical diagnostics
                </Link>
                <Link href={summary.links.payoutsPage} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                  Payouts
                </Link>
                <Link href={summary.links.qrPage} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                  QR code
                </Link>
                <Link href={summary.links.ordersFilter} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                  All orders
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Attention */}
      <AdminAttentionSection items={attentionItems} />

      {/* Status overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-oo-charcoal">Status overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatusCard title="Public listing">
            <p className="font-medium">{summary.visibility.label}</p>
            {summary.publicUrl ? (
              <p className="truncate text-xs text-oo-stone-gray">{summary.publicUrl}</p>
            ) : null}
          </AdminStatusCard>
          <AdminStatusCard title="Ordering status">
            <p className="font-medium">{summary.ordering.label}</p>
            {summary.ordering.detail ? (
              <p className="text-xs text-oo-stone-gray">{summary.ordering.detail}</p>
            ) : null}
          </AdminStatusCard>
          <AdminStatusCard title="Vendors">
            <p className="font-medium">
              {summary.vendors.totalAttached} attached · {summary.vendors.visible} visible
            </p>
            <p className="text-xs text-oo-stone-gray">
              {summary.vendors.open} open · {summary.vendors.needsAttention} need attention
            </p>
          </AdminStatusCard>
          <AdminStatusCard title="Hours">
            <p className="font-medium">{summary.hours.statusLabel}</p>
            {summary.hours.nextChangeLabel ? (
              <p className="text-xs text-oo-stone-gray">{summary.hours.nextChangeLabel}</p>
            ) : null}
          </AdminStatusCard>
          <AdminStatusCard title="Profile">
            <p className="font-medium">{summary.profile.label}</p>
            {summary.profile.missingFields.length > 0 ? (
              <p className="text-xs text-oo-stone-gray">
                Missing: {summary.profile.missingFields.slice(0, 3).join(", ")}
                {summary.profile.missingFields.length > 3 ? "…" : ""}
              </p>
            ) : (
              <p className="text-xs text-oo-stone-gray">All required fields present</p>
            )}
          </AdminStatusCard>
          <AdminStatusCard title="Orders">
            <p className="font-medium">{summary.orders.label}</p>
            <Link href={summary.links.ordersFilter} className="text-xs font-semibold underline">
              View all orders
            </Link>
          </AdminStatusCard>
          <AdminStatusCard title="Ownership">
            <p className="font-medium">{summary.access.label}</p>
            {summary.access.ownerLabel ? (
              <p className="text-xs text-oo-stone-gray">{summary.access.ownerLabel}</p>
            ) : (
              <p className="text-xs text-oo-stone-gray">No pod owner assigned</p>
            )}
          </AdminStatusCard>
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-oo-charcoal">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <AdminQuickActionButton href={summary.links.podDashboard}>Pod dashboard</AdminQuickActionButton>
          <AdminQuickActionButton href={summary.links.publicPage} external>
            Public page
          </AdminQuickActionButton>
          <AdminQuickActionButton href="#vendors">Manage vendors</AdminQuickActionButton>
          <AdminQuickActionButton href={summary.links.ordersFilter}>View orders</AdminQuickActionButton>
          <AdminQuickActionButton href={summary.links.qrPage}>QR code</AdminQuickActionButton>
          <AdminQuickActionButton href={summary.links.payoutsPage}>Payouts</AdminQuickActionButton>
          <a
            href="#ordering-controls"
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            {detail.pod.mennyuOrdersPaused ? "Resume ordering" : "Pause ordering"}
          </a>
          <a
            href="#ordering-controls"
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            {detail.pod.isActive ? "Hide pod" : "Show pod"}
          </a>
        </div>
      </section>

      {/* Vendors */}
      <section id="vendors" className="scroll-mt-6 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-oo-charcoal">Vendors</h2>
          <div className="flex flex-wrap gap-1">
            {vendorFilterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setVendorFilter(tab.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  vendorFilter === tab.key
                    ? "bg-oo-charcoal text-white"
                    : "border border-oo-light-stone text-oo-charcoal hover:bg-oo-cream"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {summary.vendorRows.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-oo-stone-gray">No vendors attached to this pod yet.</p>
            <p className="text-sm text-oo-stone-gray">Attach a vendor to start accepting orders.</p>
          </div>
        ) : filteredVendorRows.length === 0 ? (
          <p className="mt-4 text-sm text-oo-stone-gray">No vendors match this filter.</p>
        ) : (
          <ul className="mt-4 divide-y divide-oo-light-stone">
            {filteredVendorRows.map((row) => {
              const detailVendor = detail.vendors.find((v) => v.vendorId === row.vendorId);
              return (
                <li key={row.vendorId} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={buildVendorAdminPath(row.vendorId)}
                          className="text-sm font-semibold text-oo-charcoal underline"
                        >
                          {row.name}
                        </Link>
                        <AdminStatusBadge label={row.statusLabel} tone={row.tone} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-oo-stone-gray">
                        {row.cuisineLabel ? <span>{row.cuisineLabel}</span> : null}
                        <span>{row.visibilityLabel}</span>
                        <span>{row.routingLabel}</span>
                        {row.issueLabel ? <span className="text-amber-800">{row.issueLabel}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={buildVendorAdminPath(row.vendorId)} className="font-semibold underline">
                        {ADMIN_NAV_LABELS.openVendorAdmin}
                      </Link>
                      <Link href={buildVendorDashboardPath(row.vendorId)} className="font-semibold underline">
                        Dashboard
                      </Link>
                      <a
                        href={buildVendorMenuCustomerPath(summary.slug, row.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline"
                      >
                        Public menu
                      </a>
                    </div>
                  </div>

                  {detailVendor ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-oo-stone-gray hover:text-oo-charcoal">
                        Roster management
                      </summary>
                      <div className="mt-2 space-y-2 rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/40 p-3">
                        {detailVendor.podVendorActive ? (
                          <AdminReasonActionForm
                            label="Pause vendor in pod"
                            description="Pauses this vendor on this pod's public page."
                            confirmLabel="Pause in pod"
                            onSubmit={(reason) =>
                              run(() =>
                                adminSetPodVendorActiveAction({
                                  podId,
                                  vendorId: detailVendor.vendorId,
                                  isActive: false,
                                  reason,
                                })
                              )
                            }
                          />
                        ) : (
                          <AdminReasonActionForm
                            label="Activate vendor in pod"
                            description="Shows vendor as active on this pod again."
                            confirmLabel="Activate in pod"
                            onSubmit={(reason) =>
                              run(() =>
                                adminSetPodVendorActiveAction({
                                  podId,
                                  vendorId: detailVendor.vendorId,
                                  isActive: true,
                                  reason,
                                })
                              )
                            }
                          />
                        )}
                        <AdminReasonActionForm
                          label="Detach vendor"
                          description="Removes vendor from this pod roster."
                          confirmLabel="Detach"
                          danger
                          onSubmit={(reason) =>
                            run(() =>
                              adminDetachVendorFromPodFromPodAction({
                                podId,
                                vendorId: detailVendor.vendorId,
                                reason,
                              })
                            )
                          }
                        />
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="mt-4 space-y-2 rounded-lg border border-dashed border-oo-light-stone p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (e.currentTarget.elements.namedItem("vendor-attach-reason") as HTMLTextAreaElement)
              .value;
            run(() => adminAttachVendorToPodFromPodAction({ podId, vendorId: attachVendorId, reason }));
          }}
        >
          <p className="text-xs font-semibold text-oo-charcoal">Attach vendor</p>
          <select
            value={attachVendorId}
            onChange={(e) => setAttachVendorId(e.target.value)}
            required
            className="w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
          >
            <option value="">Select vendor…</option>
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          <textarea
            name="vendor-attach-reason"
            rows={2}
            required
            minLength={3}
            placeholder="Admin reason"
            className="w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            Attach vendor
          </button>
        </form>
      </section>

      {/* Recent orders */}
      <section
        id="recent-orders"
        className="scroll-mt-6 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-oo-charcoal">Recent orders</h2>
          <Link href={summary.links.ordersFilter} className="text-xs font-semibold underline">
            View all orders
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-oo-stone-gray">No recent orders.</p>
        ) : (
          <ul className="mt-3 divide-y divide-oo-light-stone">
            {recentOrders.map((order) => {
              const state = adminPodPrimaryOrderState(order);
              const vendorCount = order.vendorOrders.length;
              return (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <Link href={buildOrderAdminPath(order.id)} className="font-medium underline">
                      #{order.id.slice(-6).toUpperCase()}
                    </Link>
                    <p className="text-xs text-oo-stone-gray">
                      {formatAdminOrderDate(new Date(order.createdAt))} · {formatAdminMoney(order.totalCents)}
                      {vendorCount > 0
                        ? ` · ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                    {state.detail ? <p className="text-xs text-oo-stone-gray">{state.detail}</p> : null}
                  </div>
                  <AdminStatusBadge label={state.label} tone={state.tone} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-oo-charcoal">Recent activity</h2>
          <button
            type="button"
            className="text-xs font-semibold underline"
            onClick={() => {
              setShowAdvanced(true);
              document.getElementById("full-activity")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            View full activity
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-oo-stone-gray">No admin activity logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentActivity.map((log) => (
              <li key={log.id} className="text-sm">
                <p className="font-medium text-oo-charcoal">
                  {formatAdminAuditActionLabel(log.actionType, {
                    newValue: log.newValue,
                    podName: summary.name,
                  })}
                </p>
                <p className="text-xs text-oo-stone-gray">
                  {new Date(log.createdAt).toLocaleString()}
                  {log.adminEmail ? ` · ${log.adminEmail}` : " · System"}
                </p>
                {log.reason ? <p className="text-xs text-oo-stone-gray">Reason: {log.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ordering controls */}
      <section id="ordering-controls" className="scroll-mt-6">
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
        </AdminSection>
      </section>

      {/* Advanced settings */}
      <section id="advanced-settings" className="scroll-mt-6 space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 text-left text-sm font-semibold text-oo-charcoal shadow-sm"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          <span>Advanced settings</span>
          <span className="text-xs font-normal text-oo-stone-gray">{showAdvanced ? "Hide" : "Show"}</span>
        </button>

        {showAdvanced ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminSection title="Public profile">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = (e.currentTarget.elements.namedItem("pod-profile-reason") as HTMLTextAreaElement)
                    .value;
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
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-xs text-oo-stone-gray">
                  Description
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-xs text-oo-stone-gray">
                  Address
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-xs text-oo-stone-gray">
                  Contact email
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-xs text-oo-stone-gray">
                  Public slug
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm font-mono"
                  />
                </label>
                <textarea
                  name="pod-profile-reason"
                  placeholder="Admin reason"
                  rows={2}
                  required
                  minLength={3}
                  className="w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={profilePending}
                  className="rounded bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Save profile changes
                </button>
              </form>
              {detail.slugRedirects.length > 0 ? (
                <ul className="mt-2 text-xs text-oo-stone-gray">
                  {detail.slugRedirects.map((redirect) => (
                    <li key={redirect.id}>
                      Redirect: {redirect.oldSlug} → {redirect.newSlug}
                    </li>
                  ))}
                </ul>
              ) : null}
            </AdminSection>

            <AdminSection title="Pod owners">
              {detail.owners.length === 0 ? (
                <p className="text-sm text-oo-stone-gray">No pod owners.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.owners.map((owner) => (
                    <li key={owner.userId} className="rounded border border-oo-light-stone px-2 py-2">
                      <Link href={buildUserAdminPath(owner.userId)} className="underline">
                        {ADMIN_NAV_LABELS.openUserAdmin}
                      </Link>
                      <span className="text-oo-stone-gray">
                        {" "}
                        · {owner.email}
                        {owner.name ? ` · ${owner.name}` : ""}
                      </span>
                      <AdminReasonActionForm
                        label="Remove pod owner access"
                        description="Removes this user's pod membership. Cannot remove the only owner."
                        confirmLabel="Remove access"
                        danger
                        onSubmit={(reason) =>
                          run(() => adminRemovePodOwnerFromPodAction({ podId, userId: owner.userId, reason }))
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
                <textarea
                  name="owner-reason"
                  rows={2}
                  required
                  minLength={3}
                  placeholder="Admin reason"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
                <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
                  Add owner access
                </button>
              </form>
            </AdminSection>

            <AdminSection title="Attach vendor (admin override)">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = (e.currentTarget.elements.namedItem("advanced-vendor-attach-reason") as HTMLTextAreaElement)
                    .value;
                  run(() => adminAttachVendorToPodFromPodAction({ podId, vendorId: attachVendorId, reason }));
                }}
              >
                <select
                  value={attachVendorId}
                  onChange={(e) => setAttachVendorId(e.target.value)}
                  required
                  className="w-full rounded border px-2 py-1 text-sm"
                >
                  <option value="">Select vendor…</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                <textarea
                  name="advanced-vendor-attach-reason"
                  rows={2}
                  required
                  minLength={3}
                  placeholder="Admin reason"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
                <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
                  Attach vendor
                </button>
              </form>
            </AdminSection>

            <AdminSection title="QR / public link">
              <p className="text-sm text-oo-charcoal">{detail.pod.publicUrl}</p>
              <p className="text-xs text-oo-stone-gray">QR destination: {detail.qr.destinationUrl}</p>
              <p className="text-xs text-oo-stone-gray">
                Matches canonical: {detail.qr.matchesCanonical ? "Yes" : "No"}
              </p>
              {detail.qr.staleWarning ? (
                <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">
                  {detail.qr.staleWarning}
                </p>
              ) : null}
              <p className="text-xs text-oo-stone-gray">{detail.qr.note}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-oo-light-stone px-3 py-1.5 text-sm"
                  onClick={() => navigator.clipboard.writeText(detail.pod.publicUrl)}
                >
                  Copy public URL
                </button>
                <Link href={summary.links.qrPage} className="text-sm font-semibold underline">
                  Open QR page
                </Link>
              </div>
              <AdminReasonActionForm
                label="Confirm QR destination"
                description="Logs that the current QR should point to the canonical pod URL."
                confirmLabel="Log QR regeneration"
                onSubmit={(reason) =>
                  run(() =>
                    adminLogPodQrRegeneratedAction({ podId, reason, destinationUrl: detail.qr.destinationUrl })
                  )
                }
              />
            </AdminSection>

            <AdminSection title="Invites">
              <ul className="space-y-1 text-sm">
                <li>Pending: {detail.invites.pending}</li>
                <li>Accepted: {detail.invites.accepted}</li>
                <li>Revoked: {detail.invites.revoked}</li>
                <li>Expired: {detail.invites.expired}</li>
              </ul>
              <p className="mt-2 text-xs text-oo-stone-gray">
                Use{" "}
                <Link href="/admin/users" className="underline">
                  Users
                </Link>{" "}
                admin tools for invite repair.
              </p>
            </AdminSection>

            <AdminSection title="Maintenance">
              <AdminReasonActionForm
                label="Recheck readiness"
                description="Readiness is computed dynamically when pages load."
                confirmLabel="Log readiness recheck"
                onSubmit={(reason) => run(() => adminRecheckPodReadinessAction(podId, reason))}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={summary.links.diagnostics} className="text-sm font-semibold underline">
                  Open technical diagnostics
                </Link>
                <Link href={summary.links.payoutsPage} className="text-sm font-semibold underline">
                  Open payouts
                </Link>
              </div>
            </AdminSection>

            <div id="full-activity" className="scroll-mt-6 lg:col-span-2">
              <AdminSection title="Full activity">
                {detail.auditLogs.length === 0 ? (
                  <p className="text-sm text-oo-stone-gray">No admin actions logged yet.</p>
                ) : (
                  <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
                    {detail.auditLogs.map((log) => (
                      <li key={log.id} className="rounded border border-oo-light-stone px-2 py-1.5">
                        <p className="font-medium">
                          {formatAdminAuditActionLabel(log.actionType, {
                            newValue: log.newValue,
                            podName: summary.name,
                          })}
                        </p>
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
          </div>
        ) : null}
      </section>

      {/* Danger zone */}
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
