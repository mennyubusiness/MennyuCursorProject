/**
 * Admin/dev-only menu architecture consistency report (Phase 2).
 * Never includes tokens, encrypted credentials, or full connection records.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { diagnoseMenuProviderConsistency } from "@/domain/menu-import/menu-provider-consistency";
import { jobSourceLocationId } from "@/domain/menu-import/canonical-identity";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { isSquareProductDeliverectId } from "@/lib/integrations/square/square-menu-ids";
import { getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";

export type MenuArchitectureConsistencyFinding = {
  code: string;
  severity: "info" | "warning" | "error";
  vendorId?: string;
  vendorName?: string;
  entityId?: string;
  message: string;
};

export type MenuArchitectureConsistencyReport = {
  generatedAt: string;
  vendorId: string | null;
  findings: MenuArchitectureConsistencyFinding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
};

function summarize(findings: MenuArchitectureConsistencyFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
  };
}

export async function buildMenuArchitectureConsistencyReport(input?: {
  vendorId?: string | null;
}): Promise<MenuArchitectureConsistencyReport> {
  const vendorId = input?.vendorId?.trim() || null;
  const findings: MenuArchitectureConsistencyFinding[] = [];

  const jobs = await prisma.menuImportJob.findMany({
    where: vendorId ? { vendorId } : undefined,
    select: {
      id: true,
      vendorId: true,
      source: true,
      sourceLocationId: true,
      deliverectLocationId: true,
      vendor: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: vendorId ? 100 : 300,
  });

  let legacyFallbackReads = 0;
  let missingSourceLocation = 0;
  for (const job of jobs) {
    const loc = jobSourceLocationId(job);
    if (!loc.locationId && (job.source === "SQUARE_CATALOG_PULL" || job.source.startsWith("DELIVERECT"))) {
      missingSourceLocation += 1;
      findings.push({
        code: "import_job_missing_source_location",
        severity: "warning",
        vendorId: job.vendorId,
        vendorName: job.vendor.name,
        entityId: job.id,
        message: `Import job ${job.id} (${job.source}) has no sourceLocationId and no legacy deliverectLocationId.`,
      });
    } else if (loc.usedLegacyFallback) {
      legacyFallbackReads += 1;
    }

    if (job.source === "SQUARE_CATALOG_PULL" && job.deliverectLocationId?.trim()) {
      // New Square writers should leave this null; legacy rows may still have it.
      if (!job.sourceLocationId?.trim()) {
        findings.push({
          code: "square_job_legacy_deliverect_location_only",
          severity: "info",
          vendorId: job.vendorId,
          vendorName: job.vendor.name,
          entityId: job.id,
          message:
            "Square import job has deliverectLocationId but no sourceLocationId (legacy row; dual-read will fall back).",
        });
      }
    }
  }

  if (legacyFallbackReads > 0) {
    findings.push({
      code: "legacy_location_fallback_reads",
      severity: "info",
      vendorId: vendorId ?? undefined,
      message: `${legacyFallbackReads} recent import job(s) still require dual-read fallback from deliverectLocationId.`,
    });
  }

  const vendors = await prisma.vendor.findMany({
    where: vendorId ? { id: vendorId } : { isActive: true, deletedAt: null },
    select: { id: true, name: true, orderRoutingMode: true },
    take: vendorId ? 1 : 50,
  });

  for (const vendor of vendors) {
    const active = await loadActiveMenuVersionForVendor(vendor.id);
    if (active?.menu) {
      const parsed = openOrderCanonicalMenuSchema.safeParse(active.menu);
      if (parsed.success) {
        for (const issue of diagnoseMenuProviderConsistency(parsed.data)) {
          findings.push({
            code: issue.code,
            severity: issue.severity,
            vendorId: vendor.id,
            vendorName: vendor.name,
            entityId: issue.productExternalId,
            message: `${issue.productName}: ${issue.message}`,
          });
        }
      }
    }

    const squareLeafMisuse = await prisma.menuItem.count({
      where: {
        vendorId: vendor.id,
        isAvailable: true,
        deliverectProductId: { startsWith: "sq:prod:" },
        deliverectVariantParentPlu: { not: null },
      },
    });
    if (squareLeafMisuse > 0) {
      findings.push({
        code: "square_live_rows_use_deliverect_variant_leaf",
        severity: "error",
        vendorId: vendor.id,
        vendorName: vendor.name,
        message: `${squareLeafMisuse} available Square MenuItem row(s) have deliverectVariantParentPlu set (would hide from browse).`,
      });
    }

    if (vendor.orderRoutingMode === "square") {
      const connection = await getActiveSquareConnectionForVendor(vendor.id);
      const selectedLocation = connection?.externalLocationId?.trim() || null;

      const activeMappings = await prisma.providerEntityMapping.findMany({
        where: { vendorId: vendor.id, provider: "square", isActive: true },
        select: {
          id: true,
          internalEntityId: true,
          externalId: true,
          externalLocationId: true,
          internalEntityType: true,
        },
      });

      const dupKey = new Map<string, number>();
      for (const m of activeMappings) {
        const key = `${m.internalEntityType}:${m.internalEntityId}:${m.externalLocationId ?? ""}`;
        dupKey.set(key, (dupKey.get(key) ?? 0) + 1);
      }
      for (const [key, count] of dupKey) {
        if (count > 1) {
          findings.push({
            code: "duplicate_active_provider_mappings",
            severity: "error",
            vendorId: vendor.id,
            vendorName: vendor.name,
            entityId: key,
            message: `${count} active ProviderEntityMapping rows share identity key ${key}.`,
          });
        }
      }

      if (selectedLocation) {
        const wrongLoc = activeMappings.filter(
          (m) => m.externalLocationId && m.externalLocationId !== selectedLocation
        );
        if (wrongLoc.length > 0) {
          findings.push({
            code: "active_mappings_wrong_location",
            severity: "warning",
            vendorId: vendor.id,
            vendorName: vendor.name,
            message: `${wrongLoc.length} active Square mapping(s) are not on selected location ${selectedLocation}.`,
          });
        }
      }

      const availableSquareItems = await prisma.menuItem.findMany({
        where: {
          vendorId: vendor.id,
          isAvailable: true,
          deliverectProductId: { startsWith: "sq:prod:" },
        },
        select: { id: true, name: true, deliverectProductId: true },
        take: 200,
      });
      const mappedInternal = new Set(
        activeMappings
          .filter((m) => !selectedLocation || m.externalLocationId === selectedLocation)
          .map((m) => m.internalEntityId)
      );
      let unresolved = 0;
      for (const item of availableSquareItems) {
        const pid = item.deliverectProductId;
        if (!pid || !isSquareProductDeliverectId(pid)) continue;
        if (!mappedInternal.has(pid)) {
          unresolved += 1;
          if (unresolved <= 12) {
            findings.push({
              code: "routing_identity_unresolved",
              severity: "warning",
              vendorId: vendor.id,
              vendorName: vendor.name,
              entityId: item.id,
              message: `Available item “${item.name}” (${pid}) has no active Square mapping at the selected location.`,
            });
          }
        }
      }
      if (unresolved > 12) {
        findings.push({
          code: "routing_identity_unresolved_more",
          severity: "warning",
          vendorId: vendor.id,
          vendorName: vendor.name,
          message: `…and ${unresolved - 12} more available Square items without active selected-location mappings.`,
        });
      }
    }
  }

  if (missingSourceLocation === 0 && legacyFallbackReads === 0 && findings.length === 0) {
    findings.push({
      code: "consistency_ok",
      severity: "info",
      vendorId: vendorId ?? undefined,
      message: "No Phase 2 consistency issues detected in the scanned scope.",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    vendorId,
    findings,
    summary: summarize(findings),
  };
}
