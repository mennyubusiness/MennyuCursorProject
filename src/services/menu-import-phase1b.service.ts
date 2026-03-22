/**
 * Phase 1B: persist raw Deliverect menu payload, import job, issues, and draft MenuVersion.
 * Does not write to live MenuItem / ModifierGroup / ModifierOption.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  MenuImportIssueKind,
  MenuImportIssueSeverity,
  MenuImportJobStatus,
  type MenuImportSource,
  MenuVersionState,
} from "@prisma/client";
import type { DeliverectMenuImportMeta } from "@/domain/menu-import/canonical.schema";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import type { MenuImportIssueRecord } from "@/domain/menu-import/issues";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import { runPhase1aDeliverectMenuImport } from "@/integrations/deliverect/menu/phase1a-pipeline";

export class MenuImportVendorNotFoundError extends Error {
  constructor(public readonly vendorId: string) {
    super(`Vendor not found: ${vendorId}`);
    this.name = "MenuImportVendorNotFoundError";
  }
}

export interface IngestDeliverectMenuPhase1bParams {
  vendorId: string;
  source: MenuImportSource;
  rawPayload: unknown;
  deliverectMeta: DeliverectMenuImportMeta;
  deliverectApiVersion?: string | null;
  idempotencyKey?: string | null;
  createdBy?: string | null;
}

export interface Phase1bIngestResult {
  jobId: string;
  rawPayloadId: string;
  draftVersionId: string | null;
  menu: MennyuCanonicalMenu | null;
  ok: boolean;
  jobStatus: MenuImportJobStatus;
  issueCount: number;
  /** True when this response came from an existing idempotency key (no new run). */
  deduped: boolean;
}

export type MenuImportPhase1bDeps = {
  prisma?: PrismaClient;
};

function mapSeverity(s: MenuImportIssueRecord["severity"]): MenuImportIssueSeverity {
  switch (s) {
    case "blocking":
      return MenuImportIssueSeverity.blocking;
    case "warning":
      return MenuImportIssueSeverity.warning;
    case "info":
      return MenuImportIssueSeverity.info;
    default:
      return MenuImportIssueSeverity.blocking;
  }
}

function mapKind(k: MenuImportIssueRecord["kind"]): MenuImportIssueKind {
  return k === "normalization" ? MenuImportIssueKind.normalization : MenuImportIssueKind.validation;
}

function issueToPrismaCreate(
  jobId: string,
  issue: MenuImportIssueRecord
): Prisma.MenuImportIssueCreateManyInput {
  return {
    jobId,
    kind: mapKind(issue.kind),
    severity: mapSeverity(issue.severity),
    code: issue.code,
    message: issue.message,
    entityPath: issue.entityPath ?? undefined,
    deliverectId: issue.deliverectId ?? undefined,
    details: issue.details !== undefined ? (issue.details as Prisma.InputJsonValue) : undefined,
  };
}

async function mapExistingJobToResult(
  client: PrismaClient,
  jobId: string
): Promise<Phase1bIngestResult> {
  const job = await client.menuImportJob.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      menuImportRawPayload: true,
      draftVersion: true,
      issues: true,
    },
  });

  let menu: MennyuCanonicalMenu | null = null;
  if (job.draftVersion?.canonicalSnapshot != null) {
    const parsed = mennyuCanonicalMenuSchema.safeParse(job.draftVersion.canonicalSnapshot);
    menu = parsed.success ? parsed.data : null;
  }

  const blockingIssues = await client.menuImportIssue.count({
    where: { jobId, severity: MenuImportIssueSeverity.blocking },
  });

  const ok =
    job.status === MenuImportJobStatus.awaiting_review && blockingIssues === 0;

  return {
    jobId: job.id,
    rawPayloadId: job.menuImportRawPayload?.id ?? "",
    draftVersionId: job.draftVersionId,
    menu,
    ok,
    jobStatus: job.status,
    issueCount: job.issues.length,
    deduped: true,
  };
}

/**
 * Full Phase 1B ingest: raw row + job + run Phase 1A + issues + optional draft MenuVersion.
 */
export async function ingestDeliverectMenuImportPhase1b(
  params: IngestDeliverectMenuPhase1bParams,
  deps: MenuImportPhase1bDeps = {}
): Promise<Phase1bIngestResult> {
  const client = deps.prisma ?? prisma;

  if (params.idempotencyKey) {
    const existing = await client.menuImportJob.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return mapExistingJobToResult(client, existing.id);
    }
  }

  const vendor = await client.vendor.findUnique({ where: { id: params.vendorId }, select: { id: true } });
  if (!vendor) {
    throw new MenuImportVendorNotFoundError(params.vendorId);
  }

  const rawFingerprint = payloadFingerprint(params.rawPayload);

  const { job, rawPayload } = await client.$transaction(async (tx) => {
    const j = await tx.menuImportJob.create({
      data: {
        vendorId: params.vendorId,
        source: params.source,
        status: MenuImportJobStatus.ingested,
        deliverectChannelLinkId: params.deliverectMeta.channelLinkId ?? null,
        deliverectLocationId: params.deliverectMeta.locationId ?? null,
        deliverectMenuId: params.deliverectMeta.menuId ?? null,
        idempotencyKey: params.idempotencyKey?.trim() || undefined,
        createdBy: params.createdBy?.trim() || undefined,
      },
    });
    const raw = await tx.menuImportRawPayload.create({
      data: {
        jobId: j.id,
        payload: params.rawPayload as Prisma.InputJsonValue,
        payloadSha256: rawFingerprint,
        deliverectApiVersion: params.deliverectApiVersion?.trim() || undefined,
      },
    });
    return { job: j, rawPayload: raw };
  });

  const phase1 = runPhase1aDeliverectMenuImport({
    raw: params.rawPayload,
    vendorId: params.vendorId,
    deliverect: params.deliverectMeta,
  });

  await client.$transaction(async (tx) => {
    await tx.menuImportJob.update({
      where: { id: job.id },
      data: { status: MenuImportJobStatus.validating },
    });

    if (phase1.allIssues.length > 0) {
      await tx.menuImportIssue.createMany({
        data: phase1.allIssues.map((i) => issueToPrismaCreate(job.id, i)),
      });
    }

    if (phase1.menu) {
      const snapshotParsed = mennyuCanonicalMenuSchema.safeParse(phase1.menu);
      if (!snapshotParsed.success) {
        await tx.menuImportJob.update({
          where: { id: job.id },
          data: {
            status: MenuImportJobStatus.failed,
            completedAt: new Date(),
            errorCode: "CANONICAL_SNAPSHOT_INVALID",
            errorMessage: "Pipeline returned a menu that failed canonical schema re-validation.",
          },
        });
        return;
      }

      const snapshot = snapshotParsed.data;
      const snapshotSha = payloadFingerprint(snapshot);

      const version = await tx.menuVersion.create({
        data: {
          vendorId: params.vendorId,
          state: MenuVersionState.draft,
          canonicalSnapshot: snapshot as Prisma.InputJsonValue,
          canonicalSnapshotSha256: snapshotSha,
        },
      });

      await tx.menuImportJob.update({
        where: { id: job.id },
        data: {
          draftVersionId: version.id,
          status: MenuImportJobStatus.awaiting_review,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: phase1.ok
            ? null
            : "Import completed with blocking or validation issues; review before publish.",
        },
      });
    } else {
      await tx.menuImportJob.update({
        where: { id: job.id },
        data: {
          status: MenuImportJobStatus.failed,
          completedAt: new Date(),
          errorCode: "NO_CANONICAL_MENU",
          errorMessage: "Normalize/validate did not produce a canonical menu snapshot.",
        },
      });
    }
  });

  const finalJob = await client.menuImportJob.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true, draftVersionId: true },
  });

  const blockingIssues = await client.menuImportIssue.count({
    where: { jobId: job.id, severity: MenuImportIssueSeverity.blocking },
  });

  const ok =
    finalJob.status === MenuImportJobStatus.awaiting_review &&
    phase1.ok &&
    blockingIssues === 0;

  return {
    jobId: job.id,
    rawPayloadId: rawPayload.id,
    draftVersionId: finalJob.draftVersionId,
    menu: phase1.menu,
    ok,
    jobStatus: finalJob.status,
    issueCount: phase1.allIssues.length,
    deduped: false,
  };
}
