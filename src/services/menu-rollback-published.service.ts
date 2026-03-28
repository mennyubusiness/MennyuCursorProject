/**
 * Admin rollback: create a new published MenuVersion by copying an archived snapshot, archive current published, re-apply live tables.
 * Prior MenuVersion rows are never mutated except current → archived; source snapshot row stays archived (immutable history).
 */
import "server-only";
import { MenuVersionState, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import {
  applyCanonicalMenuToLiveTables,
  MenuPublishValidationError,
} from "@/services/menu-publish-from-canonical.service";
import { runMenuParityAudit, type MenuParityAuditResult } from "@/services/menu-parity.service";

export type RollbackPublishedMenuResult = {
  status: "rolled_back";
  newMenuVersionId: string;
  archivedMenuVersionId: string | null;
  sourceMenuVersionId: string;
  menuParity: MenuParityAuditResult;
};

/**
 * Restore live menu + current published pointer to a copy of an archived MenuVersion's canonical snapshot.
 */
export async function rollbackVendorPublishedMenu(params: {
  vendorId: string;
  sourceMenuVersionId: string;
  rolledBackBy?: string | null;
}): Promise<RollbackPublishedMenuResult> {
  const vendorId = params.vendorId?.trim();
  const sourceMenuVersionId = params.sourceMenuVersionId?.trim();
  if (!vendorId) {
    throw new MenuPublishValidationError("INVALID_VENDOR", "vendorId is required");
  }
  if (!sourceMenuVersionId) {
    throw new MenuPublishValidationError("INVALID_SOURCE", "sourceMenuVersionId is required");
  }

  const rolled = await prisma.$transaction(async (tx) => {
    const source = await tx.menuVersion.findFirst({
      where: { id: sourceMenuVersionId, vendorId },
      select: {
        id: true,
        state: true,
        canonicalSnapshot: true,
        canonicalSnapshotSha256: true,
        publishedAt: true,
      },
    });

    if (!source) {
      throw new MenuPublishValidationError(
        "SOURCE_NOT_FOUND",
        "MenuVersion not found for this vendor"
      );
    }

    if (source.state !== MenuVersionState.archived) {
      throw new MenuPublishValidationError(
        "SOURCE_NOT_ARCHIVED",
        "Rollback source must be an archived published snapshot (draft/current published cannot be used)"
      );
    }

    if (!source.publishedAt) {
      throw new MenuPublishValidationError(
        "SOURCE_NEVER_PUBLISHED",
        "Rollback source has no publishedAt; cannot restore"
      );
    }

    const currentPublished = await tx.menuVersion.findFirst({
      where: { vendorId, state: MenuVersionState.published },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const parsed = mennyuCanonicalMenuSchema.safeParse(source.canonicalSnapshot);
    if (!parsed.success) {
      throw new MenuPublishValidationError(
        "INVALID_CANONICAL",
        "Archived snapshot failed schema validation; cannot rollback"
      );
    }

    const menu = parsed.data;
    if (menu.vendorId !== vendorId) {
      throw new MenuPublishValidationError(
        "VENDOR_MISMATCH",
        "Canonical menu vendorId does not match vendor"
      );
    }

    if (menu.products.length === 0) {
      throw new MenuPublishValidationError("EMPTY_MENU", "Cannot rollback to a menu with zero products");
    }

    const archivedPrevId = currentPublished?.id ?? null;

    if (currentPublished) {
      await tx.menuVersion.updateMany({
        where: { vendorId, state: MenuVersionState.published },
        data: { state: MenuVersionState.archived },
      });
    }

    const newRow = await tx.menuVersion.create({
      data: {
        vendorId,
        state: MenuVersionState.published,
        canonicalSnapshot: source.canonicalSnapshot as Prisma.InputJsonValue,
        canonicalSnapshotSha256: source.canonicalSnapshotSha256,
        publishedAt: new Date(),
        publishedBy: params.rolledBackBy?.trim() || null,
        previousPublishedVersionId: archivedPrevId,
        restoredFromMenuVersionId: source.id,
      },
    });

    await applyCanonicalMenuToLiveTables(tx, vendorId, menu);

    return {
      status: "rolled_back" as const,
      newMenuVersionId: newRow.id,
      archivedMenuVersionId: archivedPrevId,
      sourceMenuVersionId: source.id,
    };
  });

  const menuParity = await runMenuParityAudit(vendorId);
  if (!menuParity.ok) {
    console.warn("[menu-parity] Post-rollback audit found issues", {
      vendorId,
      issueCount: menuParity.issues.length,
      codes: menuParity.issues.map((i) => i.code),
    });
  }

  return { ...rolled, menuParity };
}
