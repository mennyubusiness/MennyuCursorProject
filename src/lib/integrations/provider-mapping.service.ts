import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  IntegrationProvider,
  ProviderEntityType,
} from "@/lib/integrations/types";

/**
 * Hybrid ExternalMenuMapping contract (Phase 2):
 * - identity: vendorId + provider + internalEntityType + internalEntityId + externalLocationId
 * - externalId: provider catalog object id used for order injection
 * - externalParentId: optional parent catalog id (Square ITEM for a variation)
 * - environment / externalAccountId: optional provider context (no secrets)
 * - metadata: optional non-secret JSON diagnostics
 *
 * Do not create a competing ExternalMenuMapping table; evolve this model instead.
 */
export type UpsertProviderEntityMappingInput = {
  vendorId: string;
  connectionId?: string | null;
  provider: IntegrationProvider;
  environment?: string | null;
  internalEntityType: ProviderEntityType;
  internalEntityId: string;
  externalId: string;
  externalParentId?: string | null;
  externalLocationId?: string | null;
  externalAccountId?: string | null;
  externalVersion?: string | null;
  externalPayloadHash?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  isActive?: boolean;
};

export function hashProviderPayload(payload: unknown): string {
  const json = JSON.stringify(payload ?? null);
  return createHash("sha256").update(json).digest("hex");
}

function connectionRelationUpdate(
  connectionId: string | null | undefined
): Pick<Prisma.ProviderEntityMappingUpdateInput, "connection"> | Record<string, never> {
  if (connectionId === undefined) return {};
  if (connectionId === null) return { connection: { disconnect: true } };
  return { connection: { connect: { id: connectionId } } };
}

export async function upsertProviderEntityMapping(input: UpsertProviderEntityMappingInput) {
  const externalLocationId = input.externalLocationId ?? null;
  const existing = await prisma.providerEntityMapping.findFirst({
    where: {
      vendorId: input.vendorId,
      provider: input.provider,
      internalEntityType: input.internalEntityType,
      internalEntityId: input.internalEntityId,
      externalLocationId,
    },
    select: { id: true },
  });

  if (existing) {
    const data: Prisma.ProviderEntityMappingUpdateInput = {
      externalId: input.externalId,
      isActive: input.isActive ?? true,
      lastSeenAt: new Date(),
      ...connectionRelationUpdate(input.connectionId),
      ...(input.externalPayloadHash === undefined
        ? {}
        : { externalPayloadHash: input.externalPayloadHash }),
      ...(input.environment === undefined ? {} : { environment: input.environment }),
      ...(input.externalParentId === undefined
        ? {}
        : { externalParentId: input.externalParentId }),
      ...(input.externalAccountId === undefined
        ? {}
        : { externalAccountId: input.externalAccountId }),
      ...(input.externalVersion === undefined
        ? {}
        : { externalVersion: input.externalVersion }),
      ...(input.metadata === undefined
        ? {}
        : {
            metadata:
              input.metadata === null ? Prisma.DbNull : input.metadata,
          }),
    };

    return prisma.providerEntityMapping.update({
      where: { id: existing.id },
      data,
    });
  }

  const createData: Prisma.ProviderEntityMappingCreateInput = {
    provider: input.provider,
    internalEntityType: input.internalEntityType,
    internalEntityId: input.internalEntityId,
    externalId: input.externalId,
    externalLocationId,
    externalParentId: input.externalParentId ?? null,
    environment: input.environment ?? null,
    externalAccountId: input.externalAccountId ?? null,
    externalVersion: input.externalVersion ?? null,
    externalPayloadHash: input.externalPayloadHash ?? null,
    isActive: input.isActive ?? true,
    lastSeenAt: new Date(),
    vendor: { connect: { id: input.vendorId } },
    ...(input.connectionId
      ? { connection: { connect: { id: input.connectionId } } }
      : {}),
    ...(input.metadata === undefined
      ? {}
      : {
          metadata: input.metadata === null ? Prisma.DbNull : input.metadata,
        }),
  };

  return prisma.providerEntityMapping.create({
    data: createData,
  });
}

export async function getProviderEntityMapping(input: {
  vendorId: string;
  provider: IntegrationProvider;
  internalEntityType: ProviderEntityType;
  internalEntityId: string;
  externalLocationId?: string | null;
}) {
  return prisma.providerEntityMapping.findFirst({
    where: {
      vendorId: input.vendorId,
      provider: input.provider,
      internalEntityType: input.internalEntityType,
      internalEntityId: input.internalEntityId,
      externalLocationId: input.externalLocationId ?? null,
    },
  });
}

export async function findMappingsByExternalId(input: {
  provider: IntegrationProvider;
  externalId: string;
  vendorId?: string;
}) {
  return prisma.providerEntityMapping.findMany({
    where: {
      provider: input.provider,
      externalId: input.externalId,
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      isActive: true,
    },
  });
}

export async function countActiveMappingsForVendor(input: {
  vendorId: string;
  provider: IntegrationProvider;
}) {
  return prisma.providerEntityMapping.count({
    where: {
      vendorId: input.vendorId,
      provider: input.provider,
      isActive: true,
    },
  });
}

/** Mark mappings inactive when Square objects disappear from a re-import. */
export async function deactivateProviderMappingsNotSeen(input: {
  vendorId: string;
  provider: IntegrationProvider;
  externalLocationId?: string | null;
  seenExternalIds: Set<string>;
}): Promise<number> {
  const locationId = input.externalLocationId ?? null;
  const existing = await prisma.providerEntityMapping.findMany({
    where: {
      vendorId: input.vendorId,
      provider: input.provider,
      externalLocationId: locationId,
      isActive: true,
    },
    select: { id: true, externalId: true },
  });
  const toDeactivate = existing.filter((row) => !input.seenExternalIds.has(row.externalId));
  if (toDeactivate.length === 0) return 0;
  await prisma.providerEntityMapping.updateMany({
    where: { id: { in: toDeactivate.map((r) => r.id) } },
    data: { isActive: false },
  });
  return toDeactivate.length;
}

/**
 * Quarantine active mappings that are not for the selected Square location.
 * Historical rows remain for diagnostics but cannot satisfy readiness/order injection.
 */
export async function deactivateSquareMappingsOutsideLocation(input: {
  vendorId: string;
  selectedLocationId: string;
  /** Optional transaction client. */
  db?: Pick<typeof prisma, "providerEntityMapping">;
}): Promise<number> {
  const selected = input.selectedLocationId.trim();
  if (!selected) return 0;
  const db = input.db ?? prisma;
  const result = await db.providerEntityMapping.updateMany({
    where: {
      vendorId: input.vendorId,
      provider: "square",
      isActive: true,
      OR: [{ externalLocationId: null }, { externalLocationId: { not: selected } }],
    },
    data: { isActive: false },
  });
  return result.count;
}
