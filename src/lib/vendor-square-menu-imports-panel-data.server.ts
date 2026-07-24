import "server-only";

import { MenuImportIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchLatestPublishedMenuVersionForVendor } from "@/lib/admin-menu-import-queries";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { parseCanonicalSnapshot } from "@/lib/menu-import-canonical-preview";
import {
  buildVendorMenuPublishGate,
  countMenuImportIssues,
  formatRelativeSyncTime,
  summarizeLiveMenuSections,
  type LatestImportSummary,
} from "@/lib/vendor-menu-page.helpers";
import { evaluateMenuImportPublishEligibility } from "@/lib/menu-import-publish-eligibility";
import { menuImportFriendlySource } from "@/lib/menu-import-ui-labels";
import { loadCustomerVendorMenuSections } from "@/services/vendor-customer-menu.service";
import { integratedOrderRoutingLabel } from "@/lib/vendor-menu-route-guard.server";

export type VendorSquareMenuImportsPanelData = {
  orderRoutingLabel: string;
  publishedMenuSourceLabel: string | null;
  publishedAtIso: string | null;
  lastSquareImportAtIso: string | null;
  liveSummary: ReturnType<typeof summarizeLiveMenuSections>;
  latestDraft: {
    jobId: string;
    importedAtIso: string;
    menu: ReturnType<typeof parseCanonicalSnapshot>["menu"];
    parseError: string | null;
    draftVersionId: string | null;
    publishEligibility: ReturnType<typeof evaluateMenuImportPublishEligibility>;
    publishGate: ReturnType<typeof buildVendorMenuPublishGate>;
    issueCounts: ReturnType<typeof countMenuImportIssues>;
  } | null;
  latestImport: LatestImportSummary | null;
};

function publishedMenuSourceLabelFromSnapshot(snapshot: unknown): string | null {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  const kind = parsed.data.deliverect.sourcePayloadKind;
  if (kind === "square_catalog_v1") return "Square import";
  if (kind === "open_order_builder_v1") return "Open Order Menu Builder";
  if (kind.startsWith("deliverect_")) return "Deliverect";
  return null;
}

export async function loadVendorSquareMenuImportsPanelData(
  vendorId: string
): Promise<VendorSquareMenuImportsPanelData> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { orderRoutingMode: true },
  });

  const [
    { sections },
    publishedVersion,
    latestSquareJob,
    latestAwaitingReview,
    lastSquareImport,
  ] = await Promise.all([
    loadCustomerVendorMenuSections(vendorId),
    fetchLatestPublishedMenuVersionForVendor(vendorId),
    prisma.menuImportJob.findFirst({
      where: { vendorId, source: "SQUARE_CATALOG_PULL", status: "awaiting_review", draftVersionId: { not: null } },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        status: true,
        completedAt: true,
        startedAt: true,
        draftVersionId: true,
        draftVersion: {
          select: { state: true, canonicalSnapshot: true },
        },
        issues: { select: { severity: true, waived: true } },
      },
    }),
    prisma.menuImportJob.findFirst({
      where: {
        vendorId,
        status: "awaiting_review",
        draftVersionId: { not: null },
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        completedAt: true,
        startedAt: true,
        draftVersionId: true,
        draftVersion: {
          select: { state: true, canonicalSnapshot: true },
        },
        issues: { select: { severity: true, waived: true } },
      },
    }),
    prisma.menuImportJob.findFirst({
      where: { vendorId, source: "SQUARE_CATALOG_PULL" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, startedAt: true },
    }),
  ]);

  const liveSummary = summarizeLiveMenuSections(sections);
  const publishedMenuSourceLabel = publishedVersion
    ? publishedMenuSourceLabelFromSnapshot(publishedVersion.canonicalSnapshot)
    : null;

  let latestDraft: VendorSquareMenuImportsPanelData["latestDraft"] = null;
  if (latestSquareJob?.draftVersion) {
    const { menu, parseError } = parseCanonicalSnapshot(latestSquareJob.draftVersion.canonicalSnapshot);
    const issueCounts = countMenuImportIssues(latestSquareJob.issues);
    const publishEligibility = evaluateMenuImportPublishEligibility({
      status: latestSquareJob.status,
      draftVersionId: latestSquareJob.draftVersionId,
      draftVersion: latestSquareJob.draftVersion,
      issues: latestSquareJob.issues.map((issue) => ({
        severity: issue.severity as MenuImportIssueSeverity,
        waived: issue.waived,
      })),
    });
    const publishGate = buildVendorMenuPublishGate({
      hasLatestImport: true,
      publishEligibility,
      posConnected: true,
      canManage: true,
    });

    latestDraft = {
      jobId: latestSquareJob.id,
      importedAtIso: (latestSquareJob.completedAt ?? latestSquareJob.startedAt).toISOString(),
      menu,
      parseError,
      draftVersionId: latestSquareJob.draftVersionId,
      publishEligibility,
      publishGate,
      issueCounts,
    };
  }

  let latestImport: LatestImportSummary | null = null;
  if (latestAwaitingReview?.draftVersion) {
    const { menu } = parseCanonicalSnapshot(latestAwaitingReview.draftVersion.canonicalSnapshot);
    const issueCounts = countMenuImportIssues(latestAwaitingReview.issues);
    latestImport = {
      jobId: latestAwaitingReview.id,
      importedAtIso: (latestAwaitingReview.completedAt ?? latestAwaitingReview.startedAt).toISOString(),
      sourceLabel: menuImportFriendlySource(latestAwaitingReview.source),
      categoryCount: menu?.categories.length ?? null,
      itemCount: menu?.products.length ?? null,
      blockingIssueCount: issueCounts.blocking,
      warningIssueCount: issueCounts.warning,
      status: latestAwaitingReview.status,
    };
  } else if (publishedVersion) {
    latestImport = null;
  }

  const lastSquareImportAtIso = lastSquareImport
    ? (lastSquareImport.completedAt ?? lastSquareImport.startedAt).toISOString()
    : null;

  return {
    orderRoutingLabel: integratedOrderRoutingLabel(vendor?.orderRoutingMode ?? "square"),
    publishedMenuSourceLabel,
    publishedAtIso: publishedVersion?.publishedAt?.toISOString() ?? null,
    lastSquareImportAtIso,
    liveSummary,
    latestDraft,
    latestImport,
  };
}

export function formatSquareMenuImportsStatusLine(data: VendorSquareMenuImportsPanelData): string {
  const parts: string[] = [];
  if (data.publishedMenuSourceLabel) {
    parts.push(`Published menu source: ${data.publishedMenuSourceLabel}`);
  }
  if (data.lastSquareImportAtIso) {
    parts.push(`Last imported from Square: ${formatRelativeSyncTime(data.lastSquareImportAtIso)}`);
  }
  if (data.publishedAtIso) {
    parts.push(`Last published: ${formatRelativeSyncTime(data.publishedAtIso)}`);
  }
  parts.push(`Order routing: ${data.orderRoutingLabel} (order injection not live yet)`);
  return parts.join(" · ");
}
