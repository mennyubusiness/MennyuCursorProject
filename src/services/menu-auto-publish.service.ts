/**
 * Optional auto-publish of Deliverect menu webhook imports when vendor.autoPublishMenus is true
 * and the same eligibility rules as manual publish are satisfied.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import {
  MenuImportJobStatus,
  MenuImportSource,
  MenuImportIssueSeverity,
  MenuVersionState,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { evaluateMenuImportPublishEligibility } from "@/services/menu-publish-from-canonical.service";
import { publishMenuImportDraftToLive } from "@/services/menu-publish-from-canonical.service";

export type AutoPublishMenuImportResult =
  | { didPublish: true }
  | { didPublish: false; reason: string };

export type MenuAutoPublishDeps = {
  prisma?: PrismaClient;
};

/**
 * Attempt auto-publish after Phase 1B ingest. Safe no-op unless vendor flag + webhook + eligibility.
 */
export async function tryAutoPublishMenuImportJob(
  params: { jobId: string },
  deps: MenuAutoPublishDeps = {}
): Promise<AutoPublishMenuImportResult> {
  const client = deps.prisma ?? prisma;
  const jobId = params.jobId?.trim();
  if (!jobId) return { didPublish: false, reason: "missing_job_id" };

  const job = await client.menuImportJob.findUnique({
    where: { id: jobId },
    include: {
      vendor: { select: { id: true, autoPublishMenus: true } },
      draftVersion: true,
      issues: true,
    },
  });

  if (!job) return { didPublish: false, reason: "job_not_found" };
  if (!job.vendor.autoPublishMenus) return { didPublish: false, reason: "auto_publish_disabled" };
  if (job.source !== MenuImportSource.DELIVERECT_MENU_WEBHOOK) {
    return { didPublish: false, reason: "source_not_webhook" };
  }

  const eligibility = evaluateMenuImportPublishEligibility({
    status: job.status,
    draftVersionId: job.draftVersionId,
    draftVersion: job.draftVersion,
    issues: job.issues.map((i) => ({ severity: i.severity, waived: i.waived })),
  });

  if (!eligibility.canPublish) {
    return { didPublish: false, reason: `not_eligible: ${eligibility.reasons.join("; ")}` };
  }

  // Extra safety: explicit blocking count (non-waived) — mirrors publish service
  const blocking = job.issues.filter(
    (i) => i.severity === MenuImportIssueSeverity.blocking && !i.waived
  ).length;
  if (blocking > 0) {
    return { didPublish: false, reason: "blocking_issues" };
  }

  if (job.status !== MenuImportJobStatus.awaiting_review) {
    return { didPublish: false, reason: `not_awaiting_review:${job.status}` };
  }

  if (!job.draftVersion || job.draftVersion.state !== MenuVersionState.draft) {
    return { didPublish: false, reason: "no_draft" };
  }

  const parsed = mennyuCanonicalMenuSchema.safeParse(job.draftVersion.canonicalSnapshot);
  if (!parsed.success) {
    return { didPublish: false, reason: "canonical_invalid" };
  }

  const menu = parsed.data;
  if (menu.products.length === 0) {
    return { didPublish: false, reason: "empty_menu" };
  }
  if (menu.vendorId !== job.vendorId) {
    return { didPublish: false, reason: "vendor_mismatch" };
  }

  try {
    await publishMenuImportDraftToLive({
      jobId: job.id,
      publishedBy: "auto:deliverect_menu_webhook",
    });
    return { didPublish: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { didPublish: false, reason: `publish_failed:${msg}` };
  }
}
