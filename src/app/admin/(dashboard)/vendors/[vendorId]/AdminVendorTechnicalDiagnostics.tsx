"use client";

import Link from "next/link";
import {
  AdminInfoRow,
  AdminSection,
} from "@/components/admin/AdminReasonActionForm";
import type { BusinessHoursEvaluation } from "@/lib/business-time";
import type { AdminVendorDetailView } from "@/services/admin-vendor-detail.service";
import type { AdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import type { AdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { AdminSquareOrderInjectionDiagnosticsPanel } from "./AdminSquareOrderInjectionDiagnosticsPanel";
import {
  vendorDashboardPresenceDetail,
  vendorDashboardPresenceLabel,
} from "@/lib/vendor-dashboard-presence";
import {
  adminDeliverectMenuPosSectionVisible,
  adminInactiveDeliverectDiagnosticsVisible,
  adminInactiveSquareDiagnosticsVisible,
  adminSquareInjectionDiagnosticsVisible,
  adminVendorMenuStatusLabel,
  adminVendorOverviewMenuSourceLabel,
  adminVendorOverviewRoutingProviderLabel,
  formatAdminDownstreamPosProvider,
  type AdminVendorDetailTool,
} from "@/lib/integrations/provider-display";
import { getVendorMenuSourceMismatchWarning } from "@/lib/vendor-menu-source";

/**
 * Level-3 technical diagnostics (former main-page dumps).
 * Linked from the vendor overview — not the default management surface.
 */
export function AdminVendorTechnicalDiagnostics({
  detail,
  posSummary,
  squareStatus,
  squareInjectionDiagnostics,
  hoursDebug,
  hoursDebugPodName,
  tools,
  publicPageHref,
}: {
  detail: AdminVendorDetailView;
  posSummary: VendorPosReadinessSummary | null;
  squareStatus: AdminSquareRoutingStatus;
  squareInjectionDiagnostics: AdminSquareOrderInjectionDiagnostics | null;
  hoursDebug?: BusinessHoursEvaluation | null;
  hoursDebugPodName?: string | null;
  tools: AdminVendorDetailTool[];
  publicPageHref: string | null;
}) {
  void posSummary;
  const routingMode = detail.vendor.orderRoutingMode as VendorOrderRoutingMode;
  const showSquareDiagnostics = adminSquareInjectionDiagnosticsVisible(routingMode);
  const showDeliverectMenuPos = adminDeliverectMenuPosSectionVisible(routingMode);
  const showInactiveSquare = adminInactiveSquareDiagnosticsVisible({
    savedMode: routingMode,
    hasSquareConnection: squareStatus.hasConnection,
  });
  const showInactiveDeliverect = adminInactiveDeliverectDiagnosticsVisible({
    savedMode: routingMode,
    deliverectChannelLinkId: detail.vendor.deliverectChannelLinkId,
  });
  const downstreamPos = formatAdminDownstreamPosProvider(detail.vendor.posProvider);
  const menuStatusLabel = adminVendorMenuStatusLabel({
    hasPublishedMenu: detail.menuSync.hasPublishedMenu,
    hasDraftAwaitingReview: detail.menuSync.hasDraftAwaitingReview,
    totalItems: detail.menuSync.totalItems,
  });
  const menuMismatch = getVendorMenuSourceMismatchWarning({
    menuSource: detail.vendor.menuSource as import("@prisma/client").VendorMenuSource,
    orderRoutingMode: routingMode,
    deliverectChannelLinkId: detail.vendor.deliverectChannelLinkId,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title="Identity & raw overview">
          <AdminInfoRow label="Vendor ID" value={detail.vendor.id} />
          <AdminInfoRow label="Public URL preview" value={detail.vendor.publicPathPreview} />
          <AdminInfoRow
            label="Public visibility"
            value={
              detail.vendor.deletedAt ? "Deleted" : detail.vendor.isActive ? "Visible" : "Hidden"
            }
          />
          <AdminInfoRow
            label="Ordering paused"
            value={detail.vendor.mennyuOrdersPaused ? "Yes" : "No"}
          />
          <AdminInfoRow
            label="Routing provider"
            value={adminVendorOverviewRoutingProviderLabel(routingMode)}
          />
          <AdminInfoRow
            label="Menu source"
            value={adminVendorOverviewMenuSourceLabel({
              orderRoutingMode: routingMode,
              menuSource: detail.vendor.menuSource,
            })}
          />
          <AdminInfoRow label="Menu status" value={menuStatusLabel} />
          {menuMismatch ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <strong>{menuMismatch.headline}.</strong> {menuMismatch.detail}
            </p>
          ) : null}
          <AdminInfoRow
            label="Dashboard presence"
            value={vendorDashboardPresenceLabel(detail.vendor.vendorDashboardLastSeenAt)}
          />
          {detail.vendor.vendorDashboardLastSeenAt ? (
            <AdminInfoRow
              label="Dashboard last seen"
              value={
                vendorDashboardPresenceDetail(detail.vendor.vendorDashboardLastSeenAt) ??
                new Date(detail.vendor.vendorDashboardLastSeenAt).toLocaleString()
              }
            />
          ) : null}
          <AdminInfoRow label="Readiness summary" value={detail.readinessSummary.label} />
          <AdminInfoRow label="Onboarding status" value={detail.vendor.onboardingStatus} />
          <AdminInfoRow
            label="Created"
            value={new Date(detail.vendor.createdAt).toLocaleString()}
          />
          <AdminInfoRow
            label="squareOrderRoutingEnabled (deprecated)"
            value={String(detail.vendor.squareOrderRoutingEnabled)}
          />
        </AdminSection>

        {hoursDebug ? (
          <AdminSection title="Business hours debug">
            <p className="mb-3 text-xs text-oo-stone-gray">
              Canonical hours evaluation snapshot
              {hoursDebugPodName ? ` (pod: ${hoursDebugPodName})` : ""}.
            </p>
            <AdminInfoRow label="Timezone used" value={hoursDebug.timeZone} />
            <AdminInfoRow label="Server UTC now" value={hoursDebug.serverUtcIso} />
            <AdminInfoRow label="Business-local now" value={hoursDebug.businessLocalLabel} />
            <AdminInfoRow label="Business day" value={hoursDebug.clock.weekday} />
            <AdminInfoRow
              label="Minutes since midnight"
              value={String(hoursDebug.clock.minutesSinceMidnight)}
            />
            <AdminInfoRow
              label="Matched hours row"
              value={
                hoursDebug.matchedDay
                  ? `${hoursDebug.matchedDay.day} ${hoursDebug.matchedDay.openTime}–${hoursDebug.matchedDay.closeTime} (open=${hoursDebug.matchedDay.isOpen})`
                  : "—"
              }
            />
            <AdminInfoRow label="Computed status" value={hoursDebug.isOpen ? "Open" : "Closed"} />
            <AdminInfoRow label="Reason code" value={hoursDebug.reasonCode} />
            <AdminInfoRow label="Reason detail" value={hoursDebug.reasonDetail} />
          </AdminSection>
        ) : null}

        <AdminSection title="Stripe (technical)">
          <AdminInfoRow
            label="Connect account"
            value={detail.vendor.stripeConnectedAccountId ?? "Not connected"}
          />
          <AdminInfoRow
            label="Details submitted"
            value={detail.vendor.stripeDetailsSubmitted ? "Yes" : "No"}
          />
          <AdminInfoRow
            label="Charges enabled"
            value={detail.vendor.stripeChargesEnabled ? "Yes" : "No"}
          />
          <AdminInfoRow
            label="Payouts enabled"
            value={detail.vendor.stripePayoutsEnabled ? "Yes" : "No"}
          />
        </AdminSection>

        {showDeliverectMenuPos ? (
          <AdminSection title="Menu / Deliverect status">
            <AdminInfoRow label="Deliverect connection" value={detail.vendor.posConnectionStatus} />
            {downstreamPos ? (
              <AdminInfoRow label="Connected POS through Deliverect" value={downstreamPos} />
            ) : null}
            <AdminInfoRow
              label="Deliverect channel"
              value={detail.vendor.deliverectChannelLinkId ?? "—"}
            />
            <AdminInfoRow
              label="Deliverect location"
              value={detail.vendor.deliverectLocationId ?? "—"}
            />
            <AdminInfoRow
              label="Menu items"
              value={`${detail.menuSync.totalItems} total · ${detail.menuSync.visibleItems} visible · ${detail.menuSync.unavailableItems} unavailable`}
            />
            <AdminInfoRow
              label="Last successful sync"
              value={
                detail.menuSync.lastSuccessAt
                  ? new Date(detail.menuSync.lastSuccessAt).toLocaleString()
                  : "—"
              }
            />
            <AdminInfoRow
              label="Last failed sync"
              value={
                detail.menuSync.lastFailedAt
                  ? new Date(detail.menuSync.lastFailedAt).toLocaleString()
                  : "—"
              }
            />
          </AdminSection>
        ) : null}

        {showInactiveSquare || showInactiveDeliverect ? (
          <AdminSection title="Other connected integrations">
            {showInactiveSquare ? (
              <details className="rounded-lg border border-oo-light-stone bg-oo-cream/30 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-oo-charcoal">
                  Square (not active routing)
                </summary>
                <p className="mt-2 text-xs text-oo-stone-gray">{squareStatus.statusMessage}</p>
                {squareStatus.connectionStatus ? (
                  <p className="mt-1 text-xs text-oo-stone-gray">
                    Connection status: {squareStatus.connectionStatus}
                  </p>
                ) : null}
                <Link
                  href={squareStatus.integrationUrl}
                  className="mt-2 inline-block text-xs font-medium underline"
                >
                  Open Square integration
                </Link>
              </details>
            ) : null}
            {showInactiveDeliverect ? (
              <details className="mt-2 rounded-lg border border-oo-light-stone bg-oo-cream/30 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-oo-charcoal">
                  Deliverect (not active routing)
                </summary>
                <AdminInfoRow
                  label="Deliverect channel"
                  value={detail.vendor.deliverectChannelLinkId ?? "—"}
                />
                <AdminInfoRow
                  label="Deliverect location"
                  value={detail.vendor.deliverectLocationId ?? "—"}
                />
                <Link
                  href={`/admin/vendors/${detail.vendor.id}/deliverect-mapping`}
                  className="mt-2 inline-block text-xs font-medium underline"
                >
                  Open Deliverect mapping
                </Link>
              </details>
            ) : null}
          </AdminSection>
        ) : null}
      </div>

      {showSquareDiagnostics && squareInjectionDiagnostics ? (
        <AdminSquareOrderInjectionDiagnosticsPanel
          vendorId={detail.vendor.id}
          diagnostics={squareInjectionDiagnostics}
        />
      ) : null}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Engineering tools
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
              >
                <span className="font-medium text-oo-charcoal">{tool.title}</span>
                <span className="mt-1 text-sm text-oo-stone-gray">{tool.description}</span>
              </Link>
            </li>
          ))}
          {publicPageHref ? (
            <li>
              <a
                href={publicPageHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
              >
                <span className="font-medium text-oo-charcoal">Public page</span>
                <span className="mt-1 text-sm text-oo-stone-gray">
                  Customer-facing vendor menu and ordering
                </span>
              </a>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
