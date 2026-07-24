import "server-only";

import {
  MenuImportIssueKind,
  MenuImportIssueSeverity,
  MenuImportJobStatus,
  MenuVersionState,
  type Prisma,
} from "@prisma/client";
import { openOrderCanonicalMenuSchema, type OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import {
  explainCustomerMenuBrowseExclusions,
  type CustomerMenuBrowseExclusion,
} from "@/domain/menu-import/customer-menu-browse";
import { prisma } from "@/lib/db";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import {
  fetchSquareCatalogForLocation,
} from "@/lib/integrations/square/square-api.client";
import {
  normalizeSquareCatalogToCanonical,
  type SquareCatalogNormalizationResult,
} from "@/lib/integrations/square/square-catalog-normalizer";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";
import {
  ensureSquareAccessToken,
  evaluateSquareConnectionHealth,
  getActiveSquareConnectionForVendor,
} from "@/lib/integrations/square/square-connection.service";
import {
  deactivateProviderMappingsNotSeen,
  hashProviderPayload,
  upsertProviderEntityMapping,
} from "@/lib/integrations/provider-mapping.service";
import {
  parseSquareExternalId,
} from "@/lib/integrations/square/square-menu-ids";
import { productSourceParentExternalId } from "@/domain/menu-import/canonical-identity";
import { menuImportJobLocationWrite } from "@/domain/menu-import/menu-import-job-location";

export type SquareCatalogPreviewReport = SquareCatalogNormalizationResult & {
  locationId: string;
  locationName: string | null;
  squareEnvironment: string | null;
  /**
   * Temporary safe diagnostics: draft products that would be hidden from the customer
   * storefront after publish (same browse rules as live). No tokens/secrets.
   */
  customerBrowseExclusions: CustomerMenuBrowseExclusion[];
};

export type SquareCatalogImportReport = SquareCatalogPreviewReport & {
  jobId: string;
  draftVersionId: string | null;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  inactiveMappingsCount: number;
  errors: string[];
};

export class SquareCatalogImportError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "SquareCatalogImportError";
  }
}

async function assertSquareCatalogImportAllowed(vendorId: string) {
  const health = await evaluateSquareConnectionHealth(vendorId);
  if (!health.isReady) {
    throw new SquareCatalogImportError(
      health.missingRequirements.join("; ") || "Square connection is not ready.",
      "square_not_ready"
    );
  }
  const connection = await getActiveSquareConnectionForVendor(vendorId);
  if (!connection?.externalLocationId) {
    throw new SquareCatalogImportError(
      "Select a Square location before importing catalog.",
      "location_required"
    );
  }
  if (!connection.accessTokenRef) {
    throw new SquareCatalogImportError("Square OAuth token missing.", "token_missing");
  }
  return connection;
}

async function loadSquareCatalogForVendor(vendorId: string): Promise<{
  connection: NonNullable<Awaited<ReturnType<typeof getActiveSquareConnectionForVendor>>>;
  objects: SquareCatalogObject[];
}> {
  const connection = await assertSquareCatalogImportAllowed(vendorId);
  const token = await ensureSquareAccessToken(connection);
  if (!token) {
    throw new SquareCatalogImportError("Could not load Square access token.", "token_missing");
  }
  const objects = await fetchSquareCatalogForLocation(token, connection.externalLocationId!);
  return { connection, objects };
}

export async function previewSquareCatalogImport(
  vendorId: string
): Promise<SquareCatalogPreviewReport> {
  const { connection, objects } = await loadSquareCatalogForVendor(vendorId);
  const normalized = normalizeSquareCatalogToCanonical({
    vendorId,
    locationId: connection.externalLocationId!,
    objects,
  });
  return {
    ...normalized,
    locationId: connection.externalLocationId!,
    locationName: connection.capabilitiesMeta?.selectedLocationName ?? null,
    squareEnvironment: connection.squareEnvironment,
    customerBrowseExclusions: normalized.menu
      ? explainCustomerMenuBrowseExclusions(normalized.menu)
      : [],
  };
}

async function syncSquareCatalogMappings(input: {
  vendorId: string;
  connectionId: string;
  locationId: string;
  environment: string | null;
  externalAccountId: string | null;
  menu: OpenOrderCanonicalMenu;
  objects: SquareCatalogObject[];
}): Promise<{ imported: number; updated: number; inactive: number }> {
  const seenExternalIds = new Set<string>();
  let imported = 0;
  let updated = 0;

  const objectById = new Map(input.objects.map((o) => [o.id, o]));

  async function upsertMapping(args: {
    internalEntityType: "category" | "menu_item" | "modifier_group" | "modifier_option";
    internalEntityId: string;
    externalId: string;
    externalParentId?: string | null;
    payload: unknown;
  }) {
    seenExternalIds.add(args.externalId);
    const existing = await prisma.providerEntityMapping.findFirst({
      where: {
        vendorId: input.vendorId,
        provider: "square",
        internalEntityType: args.internalEntityType,
        internalEntityId: args.internalEntityId,
        externalLocationId: input.locationId,
      },
      select: { id: true },
    });
    await upsertProviderEntityMapping({
      vendorId: input.vendorId,
      connectionId: input.connectionId,
      provider: "square",
      environment: input.environment,
      externalAccountId: input.externalAccountId,
      internalEntityType: args.internalEntityType,
      internalEntityId: args.internalEntityId,
      externalId: args.externalId,
      externalParentId: args.externalParentId ?? null,
      externalLocationId: input.locationId,
      externalPayloadHash: hashProviderPayload(args.payload),
      isActive: true,
    });
    if (existing) updated += 1;
    else imported += 1;
  }

  for (const category of input.menu.categories) {
    const externalId = parseSquareExternalId(category.deliverectId);
    if (!externalId || externalId === "uncategorized") continue;
    await upsertMapping({
      internalEntityType: "category",
      internalEntityId: category.deliverectId,
      externalId,
      payload: objectById.get(externalId) ?? category,
    });
  }

  for (const product of input.menu.products) {
    const externalId = parseSquareExternalId(product.deliverectId);
    if (!externalId) continue;
    await upsertMapping({
      internalEntityType: "menu_item",
      internalEntityId: product.deliverectId,
      externalId,
      externalParentId: productSourceParentExternalId(product),
      payload: objectById.get(externalId) ?? product,
    });
  }

  for (const group of input.menu.modifierGroupDefinitions) {
    const externalId = parseSquareExternalId(group.deliverectId);
    if (!externalId) continue;
    await upsertMapping({
      internalEntityType: "modifier_group",
      internalEntityId: group.deliverectId,
      externalId,
      payload: objectById.get(externalId) ?? group,
    });
    for (const option of group.options) {
      const optionExternalId = parseSquareExternalId(option.deliverectId);
      if (!optionExternalId) continue;
      await upsertMapping({
        internalEntityType: "modifier_option",
        internalEntityId: option.deliverectId,
        externalId: optionExternalId,
        payload: objectById.get(optionExternalId) ?? option,
      });
    }
  }

  const inactive = await deactivateProviderMappingsNotSeen({
    vendorId: input.vendorId,
    provider: "square",
    externalLocationId: input.locationId,
    seenExternalIds,
  });

  return { imported, updated, inactive };
}

export async function importSquareCatalog(
  vendorId: string,
  createdBy?: string | null
): Promise<SquareCatalogImportReport> {
  const { connection, objects } = await loadSquareCatalogForVendor(vendorId);
  const locationId = connection.externalLocationId!;
  const normalized = normalizeSquareCatalogToCanonical({ vendorId, locationId, objects });

  if (!normalized.menu) {
    throw new SquareCatalogImportError(
      "Square catalog has no importable menu items for the selected location.",
      "empty_catalog"
    );
  }

  const parsed = openOrderCanonicalMenuSchema.safeParse(normalized.menu);
  if (!parsed.success) {
    throw new SquareCatalogImportError(
      "Normalized Square catalog failed validation.",
      "canonical_invalid"
    );
  }

  const menu = parsed.data;
  const snapshotSha = payloadFingerprint(menu);
  const rawFingerprint = payloadFingerprint(objects);

  const { job, draftVersionId } = await prisma.$transaction(async (tx) => {
    const locationCols = menuImportJobLocationWrite({
      source: "SQUARE_CATALOG_PULL",
      locationId,
    });
    const j = await tx.menuImportJob.create({
      data: {
        vendorId,
        source: "SQUARE_CATALOG_PULL",
        status: MenuImportJobStatus.ingested,
        sourceLocationId: locationCols.sourceLocationId,
        // Phase 2: Square must not write deliverectLocationId
        deliverectLocationId: locationCols.deliverectLocationId,
        createdBy: createdBy?.trim() || undefined,
      },
    });
    await tx.menuImportRawPayload.create({
      data: {
        jobId: j.id,
        payload: objects as unknown as Prisma.InputJsonValue,
        payloadSha256: rawFingerprint,
      },
    });

    if (normalized.warnings.length > 0) {
      await tx.menuImportIssue.createMany({
        data: normalized.warnings.map((w) => ({
          jobId: j.id,
          kind: MenuImportIssueKind.normalization,
          severity: MenuImportIssueSeverity.warning,
          code: w.code,
          message: w.message,
          deliverectId: w.squareObjectId,
        })),
      });
    }

    const version = await tx.menuVersion.create({
      data: {
        vendorId,
        state: MenuVersionState.draft,
        canonicalSnapshot: menu as unknown as Prisma.InputJsonValue,
        canonicalSnapshotSha256: snapshotSha,
      },
    });

    await tx.menuImportJob.update({
      where: { id: j.id },
      data: {
        draftVersionId: version.id,
        status: MenuImportJobStatus.awaiting_review,
        completedAt: new Date(),
      },
    });

    return { job: j, draftVersionId: version.id };
  });

  const mappingResult = await syncSquareCatalogMappings({
    vendorId,
    connectionId: connection.id,
    locationId,
    environment: connection.squareEnvironment ?? null,
    externalAccountId: connection.externalMerchantId ?? null,
    menu,
    objects,
  });

  // New-location import has written selected-location mappings; clear republish flag from location change.
  const meta = connection.capabilitiesMeta;
  if (meta?.menuRequiresRepublish) {
    await prisma.vendorIntegrationConnection.update({
      where: { id: connection.id },
      data: {
        capabilities: {
          ...meta,
          menuRequiresRepublish: false,
        } as object,
      },
    });
  }

  return {
    ...normalized,
    locationId,
    locationName: connection.capabilitiesMeta?.selectedLocationName ?? null,
    squareEnvironment: connection.squareEnvironment,
    customerBrowseExclusions: explainCustomerMenuBrowseExclusions(menu),
    jobId: job.id,
    draftVersionId,
    importedCount: mappingResult.imported,
    updatedCount: mappingResult.updated,
    skippedCount: normalized.skipped.length,
    warningCount: normalized.warnings.length,
    inactiveMappingsCount: mappingResult.inactive,
    errors: [],
  };
}
