"use client";

import Link from "next/link";
import { AdminInfoRow } from "@/components/admin/AdminReasonActionForm";
import type { AdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import { vendorOrderRoutingModeAdminLabel } from "@/lib/vendor-order-routing-mode";

function boolLabel(value: boolean): string {
  return value ? "true" : "false";
}

function readinessLabel(value: "ready" | "not_ready"): string {
  return value === "ready" ? "ready" : "not ready";
}

export function AdminSquareOrderInjectionDiagnosticsPanel({
  vendorId,
  diagnostics,
}: {
  vendorId: string;
  diagnostics: AdminSquareOrderInjectionDiagnostics;
}) {
  const { global, vendor } = diagnostics;

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-oo-charcoal">Square routing diagnostics</h2>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Read-only readiness snapshot. Env values are server-side and require redeploy/restart after changes.
          </p>
        </div>
        <Link
          href={`/admin/vendors/${vendorId}/square-routing-debug`}
          className="text-xs font-medium text-oo-charcoal underline"
          target="_blank"
          rel="noreferrer"
        >
          Open JSON debug
        </Link>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Global / env</h3>
        <dl className="mt-2 divide-y divide-oo-light-stone rounded-lg border border-oo-light-stone bg-oo-cream/30">
          <AdminInfoRow label="ENABLE_SQUARE_INTEGRATION" value={boolLabel(global.enableSquareIntegration)} />
          <AdminInfoRow label="SQUARE_ROUTING_LIVE" value={boolLabel(global.squareRoutingLive)} />
          <AdminInfoRow
            label="SQUARE_ENVIRONMENT"
            value={global.squareEnvironment ?? "—"}
          />
          <AdminInfoRow label="Square OAuth configured" value={boolLabel(global.squareOAuthConfigured)} />
        </dl>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendor</h3>
        <dl className="mt-2 divide-y divide-oo-light-stone rounded-lg border border-oo-light-stone bg-oo-cream/30">
          <AdminInfoRow
            label="orderRoutingMode"
            value={vendorOrderRoutingModeAdminLabel(vendor.orderRoutingMode)}
          />
          <AdminInfoRow
            label="squareOrderRoutingEnabled (deprecated)"
            value={`${boolLabel(vendor.squareOrderRoutingEnabled)} — ignored; orderRoutingMode is source of truth`}
          />
          <AdminInfoRow label="Square connection status" value={vendor.squareConnectionStatus} />
          <AdminInfoRow label="selected Square location" value={vendor.selectedSquareLocation} />
          <AdminInfoRow label="published Square-imported menu" value={vendor.publishedSquareImportedMenu} />
          <AdminInfoRow label="active item mappings" value={String(vendor.activeItemMappings)} />
          <AdminInfoRow label="active modifier mappings" value={String(vendor.activeModifierMappings)} />
          <AdminInfoRow
            label="required OAuth scopes"
            value={vendor.requiredOAuthScopes.join(", ") || "—"}
          />
          <AdminInfoRow
            label="authorized OAuth scopes"
            value={vendor.authorizedOAuthScopes.length > 0 ? vendor.authorizedOAuthScopes.join(", ") : "unknown (reconnect required)"}
          />
          <AdminInfoRow
            label="missing OAuth scopes"
            value={vendor.missingOAuthScopes.length > 0 ? vendor.missingOAuthScopes.join(", ") : "none"}
          />
          <AdminInfoRow
            label="OAuth permissions version"
            value={vendor.oauthPermissionsVersion != null ? String(vendor.oauthPermissionsVersion) : "—"}
          />
          <AdminInfoRow label="routing readiness" value={readinessLabel(vendor.routingReadiness)} />
        </dl>
      </div>

      {vendor.blockingReasons.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-950">Blocking reasons</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-900">
            {vendor.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-emerald-800">No blockers — Square routing is operational.</p>
      )}
    </section>
  );
}
