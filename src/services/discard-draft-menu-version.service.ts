/**
 * Admin-only: remove a draft MenuVersion row without deleting MenuImportJob / issues / raw payload.
 * Unlinks any job pointing at the draft, marks that job cancelled, then deletes the version.
 */
import "server-only";
import { MenuImportJobStatus, MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";

export class DraftMenuVersionDiscardError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DraftMenuVersionDiscardError";
  }
}

export type DraftDiscardEligibility = {
  canDiscard: boolean;
  reasons: string[];
};

/**
 * Read-only checks for admin UI (mirrors discard service gates).
 * `activePublishedMenuVersionId` = latest published MenuVersion id for the vendor, if any.
 */
export function evaluateDraftMenuVersionDiscardEligibility(input: {
  draftVersionId: string | null;
  draftVersion: { id: string; state: MenuVersionState } | null;
  activePublishedMenuVersionId: string | null;
}): DraftDiscardEligibility {
  const reasons: string[] = [];

  if (!input.draftVersionId || !input.draftVersion) {
    reasons.push("No draft MenuVersion linked.");
    return { canDiscard: false, reasons };
  }

  if (input.draftVersion.id !== input.draftVersionId) {
    reasons.push("Draft version record does not match job link.");
    return { canDiscard: false, reasons };
  }

  if (input.draftVersion.state !== MenuVersionState.draft) {
    reasons.push(
      `Only draft versions can be discarded (current state: ${input.draftVersion.state}). Published or archived versions are kept for history.`
    );
  }

  if (
    input.activePublishedMenuVersionId &&
    input.draftVersion.id === input.activePublishedMenuVersionId
  ) {
    reasons.push("This version is the active published menu snapshot; use a different workflow to change live data.");
  }

  return { canDiscard: reasons.length === 0, reasons };
}

/**
 * Deletes a draft MenuVersion after unlinking any MenuImportJob that references it.
 * Does not delete jobs, issues, or raw payloads.
 */
export async function discardDraftMenuVersion(params: {
  menuVersionId: string;
}): Promise<{ discardedMenuVersionId: string }> {
  const menuVersionId = params.menuVersionId?.trim();
  if (!menuVersionId) {
    throw new DraftMenuVersionDiscardError("INVALID_ID", "menuVersionId is required");
  }

  return prisma.$transaction(async (tx) => {
    const version = await tx.menuVersion.findUnique({
      where: { id: menuVersionId },
      select: { id: true, vendorId: true, state: true },
    });

    if (!version) {
      throw new DraftMenuVersionDiscardError("NOT_FOUND", "MenuVersion not found");
    }

    if (version.state !== MenuVersionState.draft) {
      throw new DraftMenuVersionDiscardError(
        "NOT_DRAFT",
        `Only draft MenuVersion rows can be discarded (state is ${version.state})`
      );
    }

    const activePublished = await tx.menuVersion.findFirst({
      where: { vendorId: version.vendorId, state: MenuVersionState.published },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (activePublished && activePublished.id === version.id) {
      throw new DraftMenuVersionDiscardError(
        "ACTIVE_PUBLISHED",
        "Cannot discard the active published MenuVersion for this vendor"
      );
    }

    const jobs = await tx.menuImportJob.findMany({
      where: { draftVersionId: version.id },
      select: { id: true },
    });

    for (const job of jobs) {
      await tx.menuImportJob.update({
        where: { id: job.id },
        data: {
          draftVersionId: null,
          status: MenuImportJobStatus.cancelled,
          errorCode: "DRAFT_DISCARDED",
          errorMessage: "Draft MenuVersion was discarded by an admin; job retained for audit.",
        },
      });
    }

    await tx.menuVersion.delete({
      where: { id: version.id },
    });

    return { discardedMenuVersionId: version.id };
  });
}

/** Discard the draft linked to a menu import job (review page entry point). */
export async function discardDraftMenuVersionForImportJob(params: {
  jobId: string;
}): Promise<{ discardedMenuVersionId: string }> {
  const jobId = params.jobId?.trim();
  if (!jobId) {
    throw new DraftMenuVersionDiscardError("INVALID_JOB", "jobId is required");
  }

  const job = await prisma.menuImportJob.findUnique({
    where: { id: jobId },
    select: {
      vendorId: true,
      draftVersionId: true,
      draftVersion: { select: { id: true, state: true } },
    },
  });

  if (!job) {
    throw new DraftMenuVersionDiscardError("JOB_NOT_FOUND", "Menu import job not found");
  }

  if (!job.draftVersionId) {
    throw new DraftMenuVersionDiscardError("NO_DRAFT", "This job has no linked draft MenuVersion");
  }

  const activePublished = await prisma.menuVersion.findFirst({
    where: { vendorId: job.vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  const eligibility = evaluateDraftMenuVersionDiscardEligibility({
    draftVersionId: job.draftVersionId,
    draftVersion: job.draftVersion,
    activePublishedMenuVersionId: activePublished?.id ?? null,
  });

  if (!eligibility.canDiscard) {
    throw new DraftMenuVersionDiscardError(
      "NOT_ELIGIBLE",
      eligibility.reasons.join(" ") || "Draft is not eligible for discard"
    );
  }

  return discardDraftMenuVersion({ menuVersionId: job.draftVersionId });
}
