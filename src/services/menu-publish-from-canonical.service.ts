/**
 * Guarded publish: draft MenuVersion canonical snapshot → live MenuItem / ModifierGroup / ModifierOption.
 * Transactional; no auto-publish. Uses Deliverect ids on rows (deliverectProductId, deliverectModifierGroupId, deliverectModifierId).
 */
import "server-only";
import {
  MenuImportJobStatus,
  MenuImportIssueSeverity,
  MenuVersionState,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getMenuPublishTransactionOptions,
  logMenuPublish,
} from "@/lib/menu-publish-transaction";
import {
  openOrderCanonicalMenuSchema,
  type OpenOrderCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import {
  explainCustomerMenuBrowseExclusions,
  type CustomerMenuBrowseExclusion,
} from "@/domain/menu-import/customer-menu-browse";
import { onMenuImportPublishedToLive } from "@/services/menu-deliverect-post-publish.service";
import { runMenuParityAudit, type MenuParityAuditResult } from "@/services/menu-parity.service";
import {
  applyCanonicalMenuToLiveTables,
  MenuPublishValidationError,
} from "@/services/menu-apply-canonical-live";
export {
  evaluateMenuImportPublishEligibility,
  noPendingMenuPublishEligibility,
  type MenuImportPublishDisplayState,
  type PublishEligibility,
} from "@/lib/menu-import-publish-eligibility";
export { applyCanonicalMenuToLiveTables, MenuPublishValidationError };

const menuImportPublishInclude = {
  issues: true,
  draftVersion: true,
} as const;

export type MenuImportJobForPublish = Prisma.MenuImportJobGetPayload<{
  include: typeof menuImportPublishInclude;
}>;

/**
 * Validates job + draft and parses canonical menu. Used before starting a DB transaction
 * (fast-fail) and again inside the transaction against a fresh read.
 */
export function classifyMenuImportForPublish(job: MenuImportJobForPublish):
  | { kind: "already_published"; menuVersionId: string }
  | {
      kind: "ready";
      menu: OpenOrderCanonicalMenu;
      vendorId: string;
      draftVersionId: string;
      jobId: string;
    } {
  if (!job.draftVersionId || !job.draftVersion) {
    throw new MenuPublishValidationError("NO_DRAFT", "No draft MenuVersion on this job");
  }

  if (job.draftVersion.state === MenuVersionState.published) {
    return { kind: "already_published", menuVersionId: job.draftVersionId };
  }

  if (job.draftVersion.state !== MenuVersionState.draft) {
    throw new MenuPublishValidationError(
      "INVALID_VERSION_STATE",
      `MenuVersion must be draft to publish (is ${job.draftVersion.state})`
    );
  }

  if (job.status !== MenuImportJobStatus.awaiting_review) {
    throw new MenuPublishValidationError(
      "JOB_NOT_REVIEWABLE",
      `Job must be awaiting_review to publish (is ${job.status})`
    );
  }

  const blocking = job.issues.filter(
    (i) => i.severity === MenuImportIssueSeverity.blocking && !i.waived
  ).length;
  if (blocking > 0) {
    throw new MenuPublishValidationError(
      "BLOCKING_ISSUES",
      `Resolve ${blocking} blocking issue(s) before publish`
    );
  }

  const parsed = openOrderCanonicalMenuSchema.safeParse(job.draftVersion.canonicalSnapshot);
  if (!parsed.success) {
    throw new MenuPublishValidationError("INVALID_CANONICAL", "Canonical snapshot failed schema validation");
  }

  const menu = parsed.data;
  if (menu.vendorId !== job.vendorId) {
    throw new MenuPublishValidationError(
      "VENDOR_MISMATCH",
      "Canonical menu vendorId does not match import job vendor"
    );
  }

  if (menu.products.length === 0) {
    throw new MenuPublishValidationError("EMPTY_MENU", "Cannot publish a canonical menu with zero products");
  }

  const availableProducts = menu.products.filter((product) => product.isAvailable);
  if (availableProducts.length === 0) {
    throw new MenuPublishValidationError(
      "NO_AVAILABLE_PRODUCTS",
      "Cannot publish a menu with zero available products"
    );
  }

  return {
    kind: "ready",
    menu,
    vendorId: job.vendorId,
    draftVersionId: job.draftVersionId,
    jobId: job.id,
  };
}

export type PublishMenuImportDraftResult =
  | {
      status: "published";
      menuVersionId: string;
      previousPublishedMenuVersionId: string | null;
      menuParity: MenuParityAuditResult;
      /**
       * Temporary safe diagnostics: draft products excluded from customer browse
       * (same rules as the live storefront). No tokens/secrets.
       */
      customerBrowseExclusions: CustomerMenuBrowseExclusion[];
    }
  | { status: "already_published"; menuVersionId: string };

/**
 * Publish this job's draft MenuVersion to live tables.
 * Callers: admin API, vendor API (scoped), auto-publish (webhook + vendor flag).
 */
export async function publishMenuImportDraftToLive(params: {
  jobId: string;
  publishedBy?: string | null;
}): Promise<PublishMenuImportDraftResult> {
  const jobId = params.jobId?.trim();
  if (!jobId) {
    throw new MenuPublishValidationError("INVALID_JOB", "jobId is required");
  }

  logMenuPublish("publish_start", { jobId });

  const publishedByTrim = params.publishedBy?.trim() ?? null;

  const prepStarted = Date.now();
  const previewJob = await prisma.menuImportJob.findUnique({
    where: { id: jobId },
    include: menuImportPublishInclude,
  });

  if (!previewJob) {
    throw new MenuPublishValidationError("NOT_FOUND", "Menu import job not found");
  }

  const preview = classifyMenuImportForPublish(previewJob);
  if (preview.kind === "already_published") {
    return { status: "already_published", menuVersionId: preview.menuVersionId };
  }

  const { menu: menuPreview, vendorId: vendorIdPreview } = preview;
  const txOpts = getMenuPublishTransactionOptions();
  logMenuPublish("publish_prep_done", {
    jobId,
    vendorId: vendorIdPreview,
    txTimeoutMs: txOpts.timeout,
    txMaxWaitMs: txOpts.maxWait,
    categoryCount: menuPreview.categories.length,
    productCount: menuPreview.products.length,
    modifierGroupCount: menuPreview.modifierGroupDefinitions.length,
    prepElapsedMs: Date.now() - prepStarted,
  });

  const publishStarted = Date.now();
  const result = await prisma.$transaction(
    async (tx) => {
      logMenuPublish("tx_open", {
        jobId,
        sincePublishStartMs: Date.now() - publishStarted,
      });

      const job = await tx.menuImportJob.findUnique({
        where: { id: jobId },
        include: menuImportPublishInclude,
      });

      if (!job) {
        throw new MenuPublishValidationError("NOT_FOUND", "Menu import job not found");
      }

      const classified = classifyMenuImportForPublish(job);
      if (classified.kind === "already_published") {
        return { status: "already_published" as const, menuVersionId: classified.menuVersionId };
      }

      const { menu, vendorId, draftVersionId: draftId } = classified;

      logMenuPublish("tx_write_phase", {
        phase: "version_pointer_and_live_tables",
        jobId,
        vendorId,
        sincePublishStartMs: Date.now() - publishStarted,
      });

      const prevPublished = await tx.menuVersion.findFirst({
        where: {
          vendorId: job.vendorId,
          state: MenuVersionState.published,
          NOT: { id: draftId },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      });

      if (prevPublished) {
        await tx.menuVersion.update({
          where: { id: prevPublished.id },
          data: { state: MenuVersionState.archived },
        });
      }

      const versionUpdate = await tx.menuVersion.updateMany({
        where: {
          id: draftId,
          vendorId: job.vendorId,
          state: MenuVersionState.draft,
        },
        data: {
          state: MenuVersionState.published,
          publishedAt: new Date(),
          publishedBy: publishedByTrim,
          previousPublishedVersionId: prevPublished?.id ?? null,
        },
      });

      if (versionUpdate.count !== 1) {
        throw new MenuPublishValidationError(
          "VERSION_CONFLICT",
          "Draft MenuVersion could not be locked (already published or missing)"
        );
      }

      await applyCanonicalMenuToLiveTables(tx, vendorId, menu, { jobId });

      await tx.menuImportJob.update({
        where: { id: job.id },
        data: {
          status: MenuImportJobStatus.succeeded,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });

      return {
        status: "published" as const,
        menuVersionId: draftId,
        previousPublishedMenuVersionId: prevPublished?.id ?? null,
        vendorId: job.vendorId,
      };
    },
    txOpts
  );

  logMenuPublish("publish_tx_finished", {
    jobId,
    status: result.status,
    totalElapsedMs: Date.now() - publishStarted,
  });

  if (result.status === "already_published") {
    return { status: "already_published", menuVersionId: result.menuVersionId };
  }

  const jobMeta = await prisma.menuImportJob.findUnique({
    where: { id: jobId },
    select: { vendorId: true, source: true },
  });
  if (jobMeta) {
    void onMenuImportPublishedToLive({
      jobId,
      vendorId: jobMeta.vendorId,
      menuVersionId: result.menuVersionId,
      source: jobMeta.source,
      publishedBy: publishedByTrim,
    }).catch((err) => {
      console.error("[menu-import] post-publish hook failed", err);
    });
  }

  const menuParity = await runMenuParityAudit(result.vendorId);
  if (!menuParity.ok) {
    console.warn("[menu-parity] Post-publish audit found issues", {
      vendorId: result.vendorId,
      issueCount: menuParity.issues.length,
      codes: menuParity.issues.map((i) => i.code),
    });
  }

  const customerBrowseExclusions = explainCustomerMenuBrowseExclusions(menuPreview);
  if (customerBrowseExclusions.length > 0) {
    console.info("[menu-publish] customer browse exclusions after publish", {
      jobId,
      vendorId: result.vendorId,
      count: customerBrowseExclusions.length,
      sample: customerBrowseExclusions.slice(0, 12).map((e) => ({
        productDeliverectId: e.productDeliverectId,
        reason: e.reason,
      })),
    });
  }

  logMenuPublish("publish_end", {
    jobId,
    menuVersionId: result.menuVersionId,
    vendorId: result.vendorId,
    parityOk: menuParity.ok,
    customerBrowseExclusionCount: customerBrowseExclusions.length,
  });

  return {
    status: "published",
    menuVersionId: result.menuVersionId,
    previousPublishedMenuVersionId: result.previousPublishedMenuVersionId,
    menuParity,
    customerBrowseExclusions,
  };
}
