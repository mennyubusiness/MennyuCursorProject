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
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
  type MennyuCanonicalProduct,
} from "@/domain/menu-import/canonical.schema";
import { orderModifierGroupsForPublish } from "@/domain/menu-import/modifier-group-publish-order";
import { onMenuImportPublishedToLive } from "@/services/menu-deliverect-post-publish.service";
import { runMenuParityAudit, type MenuParityAuditResult } from "@/services/menu-parity.service";

export class MenuPublishValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MenuPublishValidationError";
  }
}

export type PublishEligibility = {
  canPublish: boolean;
  reasons: string[];
};

/** Read-only checks for admin UI (mirrors service gates). */
export function evaluateMenuImportPublishEligibility(input: {
  status: MenuImportJobStatus;
  draftVersionId: string | null;
  draftVersion: { state: MenuVersionState; canonicalSnapshot: unknown } | null;
  issues: Array<{ severity: MenuImportIssueSeverity; waived: boolean }>;
}): PublishEligibility {
  const reasons: string[] = [];

  if (!input.draftVersionId || !input.draftVersion) {
    reasons.push("No draft MenuVersion linked to this job.");
  } else if (input.draftVersion.state !== MenuVersionState.draft) {
    reasons.push(`Draft version is not in draft state (current: ${input.draftVersion.state}).`);
  }

  const parsed = input.draftVersion
    ? mennyuCanonicalMenuSchema.safeParse(input.draftVersion.canonicalSnapshot)
    : null;
  if (input.draftVersion && !parsed?.success) {
    reasons.push("Canonical snapshot does not parse (fix import or draft data).");
  }
  if (parsed?.success && parsed.data.products.length === 0) {
    reasons.push("Canonical menu has no products to publish.");
  }

  if (input.status !== MenuImportJobStatus.awaiting_review) {
    reasons.push(`Job status must be awaiting_review (current: ${input.status}).`);
  }

  const blocking = input.issues.filter(
    (i) => i.severity === MenuImportIssueSeverity.blocking && !i.waived
  ).length;
  if (blocking > 0) {
    reasons.push(`${blocking} blocking issue(s) must be resolved or waived before publish.`);
  }

  return { canPublish: reasons.length === 0, reasons };
}

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
      menu: MennyuCanonicalMenu;
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

  const parsed = mennyuCanonicalMenuSchema.safeParse(job.draftVersion.canonicalSnapshot);
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

  return {
    kind: "ready",
    menu,
    vendorId: job.vendorId,
    draftVersionId: job.draftVersionId,
    jobId: job.id,
  };
}

/** Exported for rollback: same upsert + soft-disable rules as publish. */
export async function applyCanonicalMenuToLiveTables(
  tx: Prisma.TransactionClient,
  vendorId: string,
  menu: MennyuCanonicalMenu,
  logCtx?: { jobId?: string; source?: string }
): Promise<void> {
  const orderedGroups = orderModifierGroupsForPublish(menu.modifierGroupDefinitions);
  const groupDeliverectToDbId = new Map<string, string>();
  const optionDeliverectToDbId = new Map<string, string>();

  let sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "modifier_groups_start",
    vendorId,
    ...logCtx,
    modifierGroupCount: orderedGroups.length,
    modifierOptionCount: orderedGroups.reduce((n, g) => n + g.options.length, 0),
  });

  for (const g of orderedGroups) {
    let parentDbId: string | null = null;
    if (g.parentDeliverectOptionId != null) {
      parentDbId = optionDeliverectToDbId.get(g.parentDeliverectOptionId) ?? null;
      if (!parentDbId) {
        throw new MenuPublishValidationError(
          "MODIFIER_PARENT_MISSING",
          `Modifier group ${g.deliverectId} references unknown parent option ${g.parentDeliverectOptionId}`
        );
      }
    }

    const existingG = await tx.modifierGroup.findFirst({
      where: { vendorId, deliverectModifierGroupId: g.deliverectId },
    });

    const groupData = {
      name: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      isAvailable: true,
      parentModifierOptionId: parentDbId,
      deliverectModifierGroupId: g.deliverectId,
      deliverectIsVariantGroup: g.isVariantGroup === true,
      deliverectMultiMax: g.multiMax ?? null,
    };

    const dbGroup = existingG
      ? await tx.modifierGroup.update({
          where: { id: existingG.id },
          data: groupData,
        })
      : await tx.modifierGroup.create({
          data: { vendorId, ...groupData },
        });

    groupDeliverectToDbId.set(g.deliverectId, dbGroup.id);

    const sortedOpts = [...g.options].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const o of sortedOpts) {
      const existingO = await tx.modifierOption.findFirst({
        where: { modifierGroupId: dbGroup.id, deliverectModifierId: o.deliverectId },
      });
      const optData = {
        name: o.name,
        priceCents: o.priceCents,
        sortOrder: o.sortOrder,
        isDefault: o.isDefault,
        isAvailable: o.isAvailable,
        deliverectModifierId: o.deliverectId,
        deliverectModifierPlu: o.plu ?? null,
      };
      const dbOpt = existingO
        ? await tx.modifierOption.update({
            where: { id: existingO.id },
            data: optData,
          })
        : await tx.modifierOption.create({
            data: { modifierGroupId: dbGroup.id, ...optData },
          });
      optionDeliverectToDbId.set(o.deliverectId, dbOpt.id);
    }
  }

  logMenuPublish("apply_phase", {
    phase: "modifier_groups_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "menu_items_start",
    vendorId,
    ...logCtx,
    categoryCount: menu.categories.length,
    productCount: menu.products.length,
  });

  const draftProductIds = new Set(menu.products.map((p) => p.deliverectId));
  const draftGroupIds = new Set(menu.modifierGroupDefinitions.map((gr) => gr.deliverectId));
  const productById = new Map(menu.products.map((p) => [p.deliverectId, p]));

  const inCategory = new Set<string>();
  let sort = 0;
  const sortedCats = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of sortedCats) {
    for (const pid of cat.productDeliverectIds) {
      const p = productById.get(pid);
      if (!p) continue;
      inCategory.add(pid);
      await upsertMenuItemAndLinks(tx, vendorId, menu, p, sort++, cat.deliverectId, groupDeliverectToDbId);
    }
  }
  const sortedProducts = [...menu.products].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of sortedProducts) {
    if (!inCategory.has(p.deliverectId)) {
      await upsertMenuItemAndLinks(tx, vendorId, menu, p, sort++, null, groupDeliverectToDbId);
    }
  }

  logMenuPublish("apply_phase", {
    phase: "menu_items_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", { phase: "orphan_options_off_start", vendorId, ...logCtx });

  for (const g of menu.modifierGroupDefinitions) {
    const dbGid = groupDeliverectToDbId.get(g.deliverectId);
    if (!dbGid) continue;
    const expected = new Set(g.options.map((o) => o.deliverectId));
    const dbOpts = await tx.modifierOption.findMany({
      where: { modifierGroupId: dbGid },
      select: { id: true, deliverectModifierId: true },
    });
    for (const row of dbOpts) {
      const mid = row.deliverectModifierId;
      if (mid && !expected.has(mid)) {
        await tx.modifierOption.update({
          where: { id: row.id },
          data: { isAvailable: false },
        });
      }
    }
  }

  logMenuPublish("apply_phase", {
    phase: "orphan_options_off_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "soft_disable_stale_start",
    vendorId,
    ...logCtx,
    draftProductIdCount: draftProductIds.size,
    draftGroupIdCount: draftGroupIds.size,
  });

  if (draftProductIds.size > 0) {
    await tx.menuItem.updateMany({
      where: {
        vendorId,
        deliverectProductId: { not: null, notIn: [...draftProductIds] },
      },
      data: { isAvailable: false },
    });
  }

  if (draftGroupIds.size > 0) {
    await tx.modifierGroup.updateMany({
      where: {
        vendorId,
        deliverectModifierGroupId: { not: null, notIn: [...draftGroupIds] },
      },
      data: { isAvailable: false },
    });
  }

  logMenuPublish("apply_phase", {
    phase: "soft_disable_stale_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });
}

async function upsertMenuItemAndLinks(
  tx: Prisma.TransactionClient,
  vendorId: string,
  menu: MennyuCanonicalMenu,
  p: MennyuCanonicalProduct,
  sortOrder: number,
  deliverectCategoryId: string | null,
  groupDeliverectToDbId: Map<string, string>
): Promise<void> {
  const existing = await tx.menuItem.findFirst({
    where: { vendorId, deliverectProductId: p.deliverectId },
  });

  const itemData = {
    name: p.name,
    description: p.description ?? null,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl ?? null,
    sortOrder,
    isAvailable: p.isAvailable,
    basketMaxQuantity: p.basketMaxQuantity ?? null,
    deliverectProductId: p.deliverectId,
    deliverectPlu: p.plu ?? null,
    deliverectVariantParentPlu: p.deliverectVariantParentPlu ?? null,
    deliverectVariantParentName: p.deliverectVariantParentName ?? null,
    deliverectCategoryId,
  };

  const row = existing
    ? await tx.menuItem.update({
        where: { id: existing.id },
        data: itemData,
      })
    : await tx.menuItem.create({
        data: { vendorId, ...itemData },
      });

  /**
   * Duplicate `MenuItem` rows for the same `deliverectProductId` can exist (legacy / race).
   * `findFirst` only updates one row; orders reference `menuItemId` and may point at another duplicate
   * with stale `deliverectVariantParentPlu` / PLU — breaking Deliverect variant order shape.
   */
  await tx.menuItem.updateMany({
    where: {
      vendorId,
      deliverectProductId: p.deliverectId,
      NOT: { id: row.id },
    },
    data: {
      name: itemData.name,
      description: itemData.description,
      priceCents: itemData.priceCents,
      imageUrl: itemData.imageUrl,
      sortOrder: itemData.sortOrder,
      isAvailable: itemData.isAvailable,
      basketMaxQuantity: itemData.basketMaxQuantity,
      deliverectPlu: itemData.deliverectPlu,
      deliverectVariantParentPlu: itemData.deliverectVariantParentPlu,
      deliverectVariantParentName: itemData.deliverectVariantParentName,
      deliverectCategoryId: itemData.deliverectCategoryId,
    },
  });

  await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: row.id } });

  let linkOrder = 0;
  for (const gid of p.modifierGroupDeliverectIds) {
    const dbGid = groupDeliverectToDbId.get(gid);
    if (!dbGid) {
      throw new MenuPublishValidationError(
        "UNKNOWN_MODIFIER_GROUP_ON_PRODUCT",
        `Product ${p.deliverectId} references unknown modifier group ${gid}`
      );
    }
    const gdef = menu.modifierGroupDefinitions.find((x) => x.deliverectId === gid);
    await tx.menuItemModifierGroup.create({
      data: {
        menuItemId: row.id,
        modifierGroupId: dbGid,
        required: gdef?.isRequired ?? false,
        minSelections: gdef?.minSelections ?? 0,
        maxSelections: gdef?.maxSelections ?? 1,
        sortOrder: linkOrder++,
      },
    });
  }
}

export type PublishMenuImportDraftResult =
  | {
      status: "published";
      menuVersionId: string;
      previousPublishedMenuVersionId: string | null;
      menuParity: MenuParityAuditResult;
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

  logMenuPublish("publish_end", {
    jobId,
    menuVersionId: result.menuVersionId,
    vendorId: result.vendorId,
    parityOk: menuParity.ok,
  });

  return {
    status: "published",
    menuVersionId: result.menuVersionId,
    previousPublishedMenuVersionId: result.previousPublishedMenuVersionId,
    menuParity,
  };
}
