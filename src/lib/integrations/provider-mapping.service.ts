import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type {
  IntegrationProvider,
  ProviderEntityType,
} from "@/lib/integrations/types";
import type { Prisma } from "@prisma/client";

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

  const additive = {
    environment: input.environment ?? undefined,
    externalParentId: input.externalParentId === undefined ? undefined : input.externalParentId,
    externalAccountId: input.externalAccountId ?? undefined,
    externalVersion: input.externalVersion ?? undefined,
    metadata: input.metadata === undefined ? undefined : input.metadata,
  };

  if (existing) {
    return prisma.providerEntityMapping.update({
      where: { id: existing.id },
      data: {
        connectionId: input.connectionId ?? undefined,
        externalId: input.externalId,
        externalPayloadHash: input.externalPayloadHash ?? undefined,
        isActive: input.isActive ?? true,
        lastSeenAt: new Date(),
        ...additive,
      },
    });
  }

  return prisma.providerEntityMapping.create({
    data: {
      vendorId: input.vendorId,
      connectionId: input.connectionId ?? null,
      provider: input.provider,
      environment: input.environment ?? null,
      internalEntityType: input.internalEntityType,
      internalEntityId: input.internalEntityId,
      externalId: input.externalId,
      externalParentId: input.externalParentId ?? null,
      externalLocationId,
      externalAccountId: input.externalAccountId ?? null,
      externalVersion: input.externalVersion ?? null,
      externalPayloadHash: input.externalPayloadHash ?? null,
      metadata: input.metadata ?? undefined,
      isActive: input.isActive ?? true,
      lastSeenAt: new Date(),
    },
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
