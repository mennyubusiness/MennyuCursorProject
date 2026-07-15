"use client";

import Link from "next/link";
import { AdminInfoRow } from "@/components/admin/AdminReasonActionForm";
import type { AdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import { vendorOrderRoutingModeAdminLabel } from "@/lib/vendor-order-routing-mode";
import { AdminDeactivateStaleSquareMappingsButton } from "./AdminDeactivateStaleSquareMappingsButton";

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
  const mapping = vendor.mapping;

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-oo-charcoal">Square routing diagnostics</h2>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Read-only readiness + mapping snapshot. No tokens/secrets. Env values require
            redeploy/restart after changes.
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
          <AdminInfoRow label="SQUARE_ENVIRONMENT" value={global.squareEnvironment ?? "—"} />
          <AdminInfoRow label="Square OAuth configured" value={boolLabel(global.squareOAuthConfigured)} />
        </dl>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendor / connection</h3>
        <dl className="mt-2 divide-y divide-oo-light-stone rounded-lg border border-oo-light-stone bg-oo-cream/30">
          <AdminInfoRow label="vendorId" value={vendor.vendorId} />
          <AdminInfoRow label="vendorName" value={vendor.vendorName} />
          <AdminInfoRow
            label="orderRoutingMode"
            value={vendorOrderRoutingModeAdminLabel(vendor.orderRoutingMode)}
          />
          <AdminInfoRow
            label="squareOrderRoutingEnabled (deprecated)"
            value={`${boolLabel(vendor.squareOrderRoutingEnabled)} — ignored; orderRoutingMode is source of truth`}
          />
          <AdminInfoRow label="Square connection status" value={vendor.squareConnectionStatus} />
          <AdminInfoRow
            label="active Square connection ID"
            value={mapping.activeSquareConnectionId ?? "—"}
          />
          <AdminInfoRow label="externalMerchantId" value={mapping.externalMerchantId ?? "—"} />
          <AdminInfoRow label="externalLocationId" value={mapping.externalLocationId ?? "—"} />
          <AdminInfoRow label="connection status (row)" value={mapping.connectionStatus ?? "—"} />
          <AdminInfoRow
            label="credential ref present"
            value={boolLabel(mapping.credentialRefPresent)}
          />
          <AdminInfoRow
            label="active Square connection count"
            value={String(mapping.activeSquareConnectionCount)}
          />
          <AdminInfoRow label="selected Square location" value={vendor.selectedSquareLocation} />
          <AdminInfoRow label="published Square-imported menu" value={vendor.publishedSquareImportedMenu} />
          <AdminInfoRow
            label="publishedMenuVersionId"
            value={mapping.publishedMenuVersionId ?? "—"}
          />
          <AdminInfoRow
            label="published sourcePayloadKind"
            value={mapping.publishedSourcePayloadKind ?? "—"}
          />
          <AdminInfoRow
            label="active published item count"
            value={String(mapping.activePublishedItemCount)}
          />
          <AdminInfoRow
            label="active Square mappings (vendor + selected location)"
            value={String(mapping.activeSquareProviderEntityMappingCountForVendorAndLocation)}
          />
          <AdminInfoRow
            label="active Square item mappings (vendor + location)"
            value={String(mapping.activeSquareItemMappingsForVendorAndLocation)}
          />
          <AdminInfoRow
            label="active Square modifier mappings (vendor + location)"
            value={String(mapping.activeSquareModifierMappingsForVendorAndLocation)}
          />
          <AdminInfoRow label="active item mappings (readiness)" value={String(vendor.activeItemMappings)} />
          <AdminInfoRow
            label="active modifier mappings (readiness)"
            value={String(vendor.activeModifierMappings)}
          />
          <AdminInfoRow
            label="mappings exist for another location"
            value={boolLabel(mapping.mappingsExistForAnotherLocation)}
          />
          <AdminInfoRow
            label="mapping coverage"
            value={`${vendor.mappingCoverage.mappedSellableItems} / ${vendor.mappingCoverage.totalSellableItems} sellable items`}
          />
          <AdminInfoRow
            label="coverage ready"
            value={boolLabel(vendor.mappingCoverage.ready)}
          />
          <AdminInfoRow
            label="missing sellable item ids (sample)"
            value={
              vendor.mappingCoverage.missingItemIds.length > 0
                ? vendor.mappingCoverage.missingItemIds.slice(0, 8).join(", ")
                : "none"
            }
          />
          <AdminInfoRow
            label="alternate mapping locations"
            value={
              vendor.mappingCoverage.alternateLocationIds.length > 0
                ? vendor.mappingCoverage.alternateLocationIds.join(", ")
                : "none"
            }
          />
          <AdminInfoRow
            label="coverage blockers"
            value={
              vendor.mappingCoverage.blockers.length > 0
                ? vendor.mappingCoverage.blockers
                    .slice(0, 8)
                    .map((b) => `${b.code}:${b.internalId}`)
                    .join("; ")
                : "none"
            }
          />
          <AdminInfoRow
            label="required OAuth scopes"
            value={vendor.requiredOAuthScopes.join(", ") || "—"}
          />
          <AdminInfoRow
            label="authorized OAuth scopes"
            value={
              vendor.authorizedOAuthScopes.length > 0
                ? vendor.authorizedOAuthScopes.join(", ")
                : "unknown (reconnect required)"
            }
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

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Mappings by location
        </h3>
        {mapping.activeSquareMappingsByLocation.length === 0 ? (
          <p className="mt-2 text-xs text-oo-stone-gray">No active Square mappings for this vendor.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-oo-charcoal">
            {mapping.activeSquareMappingsByLocation.map((row) => (
              <li key={row.key ?? "null"} className="font-mono">
                {(row.key ?? "(null location)") +
                  ` — total ${row.totalCount} (items ${row.itemCount}, modifiers ${row.modifierCount})`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Mappings by connectionId
        </h3>
        {mapping.activeSquareMappingsByConnectionId.length === 0 ? (
          <p className="mt-2 text-xs text-oo-stone-gray">No active Square mappings for this vendor.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-oo-charcoal">
            {mapping.activeSquareMappingsByConnectionId.map((row) => (
              <li key={row.key ?? "null"} className="font-mono">
                {(row.key ?? "(null connectionId)") +
                  ` — total ${row.totalCount} (items ${row.itemCount}, modifiers ${row.modifierCount})`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          First 10 unmapped published items
        </h3>
        {mapping.first10UnmappedPublishedItems.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-800">None (all available published items mapped at selected location).</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-oo-charcoal">
            {mapping.first10UnmappedPublishedItems.map((item) => (
              <li key={item.id} className="font-mono">
                {item.id} — {item.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          First 10 mapping external IDs (selected location items)
        </h3>
        {mapping.first10MappingExternalIds.length === 0 ? (
          <p className="mt-2 text-xs text-oo-stone-gray">No item mappings at selected location.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-oo-charcoal">
            {mapping.first10MappingExternalIds.map((m) => (
              <li key={`${m.internalEntityId}-${m.externalId}`} className="font-mono">
                {m.externalId} ← {m.internalEntityId} ({m.internalEntityType})
              </li>
            ))}
          </ul>
        )}
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

      {mapping.mappingsExistForAnotherLocation ||
      vendor.mappingCoverage.alternateLocationIds.length > 0 ? (
        <AdminDeactivateStaleSquareMappingsButton vendorId={vendorId} />
      ) : null}
    </section>
  );
}
