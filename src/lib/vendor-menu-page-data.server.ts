import "server-only";

import { MenuImportIssueSeverity } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchLatestPublishedMenuVersionForVendor } from "@/lib/admin-menu-import-queries";
import { menuImportFriendlySource } from "@/lib/menu-import-ui-labels";
import { parseCanonicalSnapshot } from "@/lib/menu-import-canonical-preview";
import {
  buildVendorMenuPublishGate,
  countMenuImportIssues,
  flattenMenuSectionsForDisplay,
  formatLiveMenuSourceLabel,
  summarizeLiveMenuSections,
  type LatestImportSummary,
  type VendorMenuDisplayItem,
} from "@/lib/vendor-menu-page.helpers";
import { evaluateDeliverectMenuIntegrityForVendor } from "@/services/deliverect-menu-integrity.service";
import { evaluateMenuImportPublishEligibility } from "@/services/menu-publish-from-canonical.service";
import { loadCustomerVendorMenuSections } from "@/services/vendor-customer-menu.service";

export type VendorMenuPageData = {
  vendorId: string;
  vendorName: string;
  menuSource: ReturnType<typeof formatLiveMenuSourceLabel>;
  liveSummary: ReturnType<typeof summarizeLiveMenuSections>;
  hasPublishedMenuVersion: boolean;
  publishedAtIso: string | null;
  publishedMenuVersionId: string | null;
  displayItems: VendorMenuDisplayItem[];
  latestImport: LatestImportSummary | null;
  publishGate: ReturnType<typeof buildVendorMenuPublishGate>;
  publishEligibilityReasons: string[];
  canManage: boolean;
  canAdminPull: boolean;
  posConnected: boolean;
  autoPublishMenus: boolean;
  menuHealth: {
    ready: boolean;
    criticalCount: number;
    warningCount: number;
    detailHref: string;
    detailLabel: string;
  };
};

export async function loadVendorMenuPageData(vendorId: string): Promise<VendorMenuPageData | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      autoPublishMenus: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
    },
  });
  if (!vendor) return null;

  const session = await auth();
  const isPlatformAdmin = Boolean(session?.user?.isPlatformAdmin);
  // Vendor dashboard layout already authorized access (membership, admin, or legacy token).
  const canManage = true;

  const [{ sections, source }, publishedVersion, latestJob, integrity] = await Promise.all([
    loadCustomerVendorMenuSections(vendorId),
    fetchLatestPublishedMenuVersionForVendor(vendorId),
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
        startedAt: true,
        completedAt: true,
        draftVersionId: true,
        draftVersion: {
          select: {
            state: true,
            canonicalSnapshot: true,
          },
        },
        issues: {
          select: { severity: true, waived: true },
        },
      },
    }),
    vendor.deliverectChannelLinkId?.trim()
      ? evaluateDeliverectMenuIntegrityForVendor(vendorId)
      : Promise.resolve(null),
  ]);

  const liveSummary = summarizeLiveMenuSections(sections);
  const hasPublishedMenuVersion = source === "published_canonical" && Boolean(publishedVersion);
  const mappingWarningItemIds = new Set<string>();
  if (integrity) {
    for (const finding of integrity.findings) {
      if (finding.menuItemId && (finding.severity === "critical" || finding.severity === "warning")) {
        mappingWarningItemIds.add(finding.menuItemId);
      }
    }
  }

  const displayItems = flattenMenuSectionsForDisplay(sections, mappingWarningItemIds);

  let latestImport: LatestImportSummary | null = null;
  let publishEligibility = { canPublish: false, reasons: ["No unpublished menu import waiting to publish."] };

  if (latestJob) {
    const issueCounts = countMenuImportIssues(latestJob.issues);
    const { menu } = latestJob.draftVersion
      ? parseCanonicalSnapshot(latestJob.draftVersion.canonicalSnapshot)
      : { menu: null };

    latestImport = {
      jobId: latestJob.id,
      importedAtIso: (latestJob.completedAt ?? latestJob.startedAt).toISOString(),
      sourceLabel: menuImportFriendlySource(latestJob.source),
      categoryCount: menu?.categories.length ?? null,
      itemCount: menu?.products.length ?? null,
      blockingIssueCount: issueCounts.blocking,
      warningIssueCount: issueCounts.warning,
      status: latestJob.status,
    };

    publishEligibility = evaluateMenuImportPublishEligibility({
      status: latestJob.status,
      draftVersionId: latestJob.draftVersionId,
      draftVersion: latestJob.draftVersion,
      issues: latestJob.issues.map((i) => ({
        severity: i.severity as MenuImportIssueSeverity,
        waived: i.waived,
      })),
    });
  }

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );

  const publishGate = buildVendorMenuPublishGate({
    hasLatestImport: Boolean(latestImport),
    publishEligibility,
    posConnected,
    canManage,
  });

  const healthDetailHref = latestImport
    ? `/vendor/${vendorId}/menu-imports/${latestImport.jobId}`
    : `/vendor/${vendorId}/settings?section=pos-menu`;
  const healthDetailLabel = latestImport ? "Review import details" : "Open POS & menu settings";

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    menuSource: formatLiveMenuSourceLabel(source),
    liveSummary,
    hasPublishedMenuVersion,
    publishedAtIso: publishedVersion?.publishedAt?.toISOString() ?? null,
    publishedMenuVersionId: publishedVersion?.id ?? null,
    displayItems,
    latestImport,
    publishGate,
    publishEligibilityReasons: publishEligibility.reasons,
    canManage,
    canAdminPull: isPlatformAdmin,
    posConnected,
    autoPublishMenus: vendor.autoPublishMenus ?? false,
    menuHealth: {
      ready: integrity ? integrity.deliverectReady && liveSummary.availableCount > 0 : liveSummary.availableCount > 0,
      criticalCount: integrity?.criticalCount ?? 0,
      warningCount: integrity?.warningCount ?? 0,
      detailHref: healthDetailHref,
      detailLabel: healthDetailLabel,
    },
  };
}
