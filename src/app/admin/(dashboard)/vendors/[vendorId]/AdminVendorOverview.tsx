"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { AdminVendorSummary } from "@/lib/admin-vendor-summary";
import {
  adminVendorPrimaryOrderState,
  formatAdminAuditActionLabel,
} from "@/lib/admin-vendor-summary";
import { formatAdminMoney, formatAdminOrderDate } from "@/lib/admin-order-detail-ui";
import { buildOrderAdminPath } from "@/lib/admin-entity-nav-links";
import type { AdminVendorDetailView } from "@/services/admin-vendor-detail.service";
import type { AdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";
import { buildVendorPosReadinessFallback } from "@/lib/pos-connection-status";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { AdminVendorOrderRoutingSection } from "./AdminVendorOrderRoutingSection";
import { AdminEntityDeleteDangerZone } from "@/components/admin/AdminEntityDeleteDangerZone";
import {
  AdminReasonActionForm,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
import {
  adminAttachVendorToPodFromVendorAction,
  adminDetachVendorFromPodFromVendorAction,
  adminHideVendorAction,
  adminPauseVendorOrderingAction,
  adminRecheckVendorReadinessAction,
  adminRestoreVendorSlugAction,
  adminShowVendorAction,
  adminUnpauseVendorOrderingAction,
  adminUpdateVendorPublicProfileAction,
  adminDeleteVendorProfileAction,
} from "@/actions/admin-vendor.actions";
import {
  ADMIN_NAV_LABELS,
  buildPodAdminPath,
  buildPodDashboardPath,
  buildUserAdminPath,
} from "@/lib/admin-entity-nav-links";

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-oo-light-stone bg-oo-cream text-oo-charcoal";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function OverviewCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">{title}</h3>
        {action}
      </div>
      <div className="mt-2 space-y-1 text-sm text-oo-charcoal">{children}</div>
    </div>
  );
}

type Option = { id: string; name: string };

export function AdminVendorOverview({
  summary,
  detail,
  podOptions,
  posSummary,
  squareStatus,
}: {
  summary: AdminVendorSummary;
  detail: AdminVendorDetailView;
  podOptions: Option[];
  /** Prefer the readiness bundle; fall back when the loader cannot supply one. */
  posSummary: VendorPosReadinessSummary | null;
  squareStatus: AdminSquareRoutingStatus;
}) {
  const router = useRouter();
  const vendorId = detail.vendor.id;
  const [showRoutingEditor, setShowRoutingEditor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [name, setName] = useState(detail.vendor.name);
  const [description, setDescription] = useState(detail.vendor.description ?? "");
  const [contactEmail, setContactEmail] = useState(detail.vendor.contactEmail ?? "");
  const [slug, setSlug] = useState(detail.vendor.slug);
  const [attachPodId, setAttachPodId] = useState("");
  const [profilePending, startProfileTransition] = useTransition();

  const fallbackPosSummary: VendorPosReadinessSummary = buildVendorPosReadinessFallback({
    posConnectionStatus: detail.vendor.posConnectionStatus,
    deliverectChannelLinkId: detail.vendor.deliverectChannelLinkId,
    orderRoutingMode: detail.vendor.orderRoutingMode,
    menuSource: detail.vendor.menuSource,
  });
  const resolvedPosSummary = posSummary ?? fallbackPosSummary;

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    fn().then((r) => {
      if (r.ok) router.refresh();
      return r;
    });

  const recentOrders = detail.recentOrders.slice(0, 5);
  const recentActivity = detail.auditLogs.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{summary.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-oo-stone-gray">
              <span>/{summary.slug}</span>
              {summary.podName ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{summary.podName}</span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge label={summary.overallStatus.label} tone={summary.overallStatus.tone} />
              <StatusBadge label={summary.routingBadge.label} tone="neutral" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={summary.links.vendorDashboard}
              className="inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Open vendor dashboard
            </Link>
            {summary.links.publicPage ? (
              <a
                href={summary.links.publicPage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-oo-light-stone px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                View public page
              </a>
            ) : null}
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
                <Link href={summary.links.ordersFilter} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                  All orders
                </Link>
                {summary.links.podAdmin ? (
                  <Link href={summary.links.podAdmin} className="block rounded px-2 py-1.5 hover:bg-oo-cream">
                    Open pod admin
                  </Link>
                ) : null}
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Attention */}
      {summary.attentionItems.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-oo-charcoal">Attention required</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {summary.attentionItems.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.tone === "danger"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-sm font-semibold text-oo-charcoal">{item.title}</p>
                <p className="mt-1 text-sm text-oo-stone-gray">{item.consequence}</p>
                {item.actionHref ? (
                  item.actionKind === "anchor" ? (
                    <a
                      href={item.actionHref}
                      className="mt-3 inline-flex rounded-lg bg-oo-charcoal px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => {
                        if (item.actionHref === "#advanced-settings") setShowAdvanced(true);
                      }}
                    >
                      {item.actionLabel}
                    </a>
                  ) : (
                    <Link
                      href={item.actionHref}
                      className="mt-3 inline-flex rounded-lg bg-oo-charcoal px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {item.actionLabel}
                    </Link>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Status overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-oo-charcoal">Status overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <OverviewCard title="Public listing">
            <p className="font-medium">{summary.visibility.label}</p>
            {summary.publicUrl ? (
              <p className="truncate text-xs text-oo-stone-gray">{summary.publicUrl}</p>
            ) : null}
          </OverviewCard>
          <OverviewCard title="Ordering">
            <p className="font-medium">{summary.ordering.label}</p>
            <p className="text-xs text-oo-stone-gray">
              {summary.hours.statusLabel}
              {summary.hours.nextChangeLabel ? ` · ${summary.hours.nextChangeLabel}` : ""}
            </p>
          </OverviewCard>
          <OverviewCard title="Menu">
            <p className="font-medium">{summary.menu.statusLabel}</p>
            <p className="text-xs text-oo-stone-gray">
              {summary.menu.availableItemCount} available items
              {summary.menu.lastPublishedLabel ? ` · Last sync ${summary.menu.lastPublishedLabel}` : ""}
            </p>
          </OverviewCard>
          <OverviewCard title="Payments">
            <p className="font-medium">{summary.payments.label}</p>
            {summary.payments.issue ? (
              <p className="text-xs text-oo-stone-gray">{summary.payments.issue}</p>
            ) : (
              <p className="text-xs text-oo-stone-gray">Payouts ready</p>
            )}
          </OverviewCard>
          <OverviewCard
            title="Order routing"
            action={
              <button
                type="button"
                className="text-xs font-semibold text-oo-charcoal underline"
                onClick={() => setShowRoutingEditor((v) => !v)}
              >
                Manage
              </button>
            }
          >
            <p className="font-medium">{summary.routing.managedInLabel}</p>
            {summary.routing.summaryLines.map((line) => (
              <p key={line} className="text-xs text-oo-stone-gray">
                {line}
              </p>
            ))}
          </OverviewCard>
          <OverviewCard title="Pod membership">
            <p className="font-medium">{summary.pod.label}</p>
            {summary.links.podAdmin ? (
              <Link href={summary.links.podAdmin} className="text-xs font-semibold underline">
                Open pod
              </Link>
            ) : null}
          </OverviewCard>
        </div>

        {showRoutingEditor ? (
          <div className="mt-2">
            <AdminVendorOrderRoutingSection
              vendorId={vendorId}
              orderRoutingMode={detail.vendor.orderRoutingMode as VendorOrderRoutingMode}
              posSummary={resolvedPosSummary}
              squareStatus={squareStatus}
            />
          </div>
        ) : null}
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-oo-charcoal">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={summary.links.vendorDashboard}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Vendor dashboard
          </Link>
          {summary.links.publicPage ? (
            <a
              href={summary.links.publicPage}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Public page
            </a>
          ) : null}
          <Link
            href={summary.links.menuManage}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Manage menu
          </Link>
          {detail.vendor.orderRoutingMode === "square" ? (
            <Link
              href={summary.links.squareManage}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Manage Square
            </Link>
          ) : null}
          <Link
            href={summary.links.ordersFilter}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            View orders
          </Link>
          <a
            href="#ordering-controls"
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            {detail.vendor.mennyuOrdersPaused ? "Resume ordering" : "Pause ordering"}
          </a>
        </div>
      </section>

      {/* Recent orders */}
      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
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
            {recentOrders.map((o) => {
              const state = adminVendorPrimaryOrderState(o);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <Link href={buildOrderAdminPath(o.id)} className="font-medium underline">
                      #{o.id.slice(-6).toUpperCase()}
                    </Link>
                    <p className="text-xs text-oo-stone-gray">
                      {formatAdminOrderDate(new Date(o.createdAt))} · {formatAdminMoney(o.totalCents)}
                    </p>
                  </div>
                  <StatusBadge label={state.label} tone={state.tone} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Activity */}
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
                    podName: summary.podName,
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

      {/* Ordering controls (targeted by quick actions) */}
      <section id="ordering-controls" className="scroll-mt-6">
        <AdminSection title="Ordering controls">
          {detail.vendor.mennyuOrdersPaused ? (
            <AdminReasonActionForm
              label="Resume ordering"
              description="Allows customers to place new orders again."
              confirmLabel="Resume ordering"
              onSubmit={(reason) => run(() => adminUnpauseVendorOrderingAction(vendorId, reason))}
            />
          ) : (
            <AdminReasonActionForm
              label="Pause ordering"
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
        </AdminSection>
      </section>

      {/* Advanced settings */}
      <section id="advanced-settings" className="scroll-mt-6 space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 text-left text-sm font-semibold text-oo-charcoal shadow-sm"
          onClick={() => setShowAdvanced((v) => !v)}
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
                  const reason = (e.currentTarget.elements.namedItem("profile-reason") as HTMLTextAreaElement)
                    .value;
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
                    className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
                  />
                </label>
                <textarea
                  name="profile-reason"
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
              {detail.slugRedirects[0] ? (
                <AdminReasonActionForm
                  label={`Restore slug ${detail.slugRedirects[0].oldSlug}`}
                  description="Restores a previous slug if no collision exists."
                  confirmLabel="Restore previous slug"
                  onSubmit={(reason) =>
                    run(() =>
                      adminRestoreVendorSlugAction(vendorId, detail.slugRedirects[0]!.oldSlug, reason)
                    )
                  }
                />
              ) : null}
            </AdminSection>

            <AdminSection title="Access">
              {detail.owners.length === 0 ? (
                <p className="text-sm text-oo-stone-gray">No linked users.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {detail.owners.map((o) => (
                    <li key={o.userId}>
                      <Link href={buildUserAdminPath(o.userId)} className="underline">
                        {ADMIN_NAV_LABELS.openUserAdmin}
                      </Link>
                      <span className="text-oo-stone-gray">
                        {" "}
                        · {o.email} · {o.role}
                      </span>
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
                      <p className="font-medium text-oo-charcoal">{p.podName}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <Link href={buildPodAdminPath(p.podId)} className="underline">
                          {ADMIN_NAV_LABELS.openPodAdmin}
                        </Link>
                        <Link href={buildPodDashboardPath(p.podId)} className="underline">
                          {ADMIN_NAV_LABELS.openPodDashboard}
                        </Link>
                      </div>
                      <AdminReasonActionForm
                        label="Detach from pod"
                        description={`Remove vendor from ${p.podName}.`}
                        confirmLabel="Detach"
                        danger
                        onSubmit={(reason) =>
                          run(() =>
                            adminDetachVendorFromPodFromVendorAction({
                              vendorId,
                              podId: p.podId,
                              reason,
                            })
                          )
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
                  const reason = (e.currentTarget.elements.namedItem("attach-reason") as HTMLTextAreaElement)
                    .value;
                  run(() =>
                    adminAttachVendorToPodFromVendorAction({ vendorId, podId: attachPodId, reason })
                  );
                }}
              >
                <p className="text-xs font-medium">Attach to pod</p>
                <select
                  value={attachPodId}
                  onChange={(e) => setAttachPodId(e.target.value)}
                  required
                  className="w-full rounded border px-2 py-1 text-sm"
                >
                  <option value="">Select pod…</option>
                  {podOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <textarea
                  name="attach-reason"
                  rows={2}
                  required
                  minLength={3}
                  placeholder="Admin reason"
                  className="w-full rounded border px-2 py-1 text-sm"
                />
                <button type="submit" className="rounded bg-brand px-2 py-1 text-xs text-white">
                  Attach to pod
                </button>
              </form>
            </AdminSection>

            <AdminSection title="Maintenance">
              <AdminReasonActionForm
                label="Log readiness recheck"
                description="Records that an admin reviewed readiness. Does not change vendor state."
                confirmLabel="Log recheck"
                onSubmit={(reason) => run(() => adminRecheckVendorReadinessAction(vendorId, reason))}
              />
              <Link
                href={summary.links.diagnostics}
                className="mt-3 inline-block text-sm font-semibold underline"
              >
                Open technical diagnostics
              </Link>
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
                            podName: summary.podName,
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
        title="Delete vendor"
        description="The vendor will be hidden, paused, and removed from public ordering. Historical orders and payment records are preserved."
        confirmLabel="Delete vendor"
        confirmationAlternatives={["DELETE", detail.vendor.name]}
        deletedAt={detail.vendor.deletedAt}
        deletedByEmail={detail.vendor.deletedByEmail}
        onSubmit={({ reason }) =>
          adminDeleteVendorProfileAction(vendorId, reason).then((result) => {
            if (result.ok) router.refresh();
            return result;
          })
        }
      />
    </div>
  );
}
