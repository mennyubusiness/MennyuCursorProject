import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type {
  IntegrationProvider,
  ProviderEntityType,
} from "@/lib/integrations/types";

export type UpsertProviderEntityMappingInput = {
  vendorId: string;
  connectionId?: string | null;
  provider: IntegrationProvider;
  internalEntityType: ProviderEntityType;
  internalEntityId: string;
  externalId: string;
  externalLocationId?: string | null;
  externalPayloadHash?: string | null;
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

  if (existing) {
    return prisma.providerEntityMapping.update({
      where: { id: existing.id },
      data: {
        connectionId: input.connectionId ?? undefined,
        externalId: input.externalId,
        externalPayloadHash: input.externalPayloadHash ?? undefined,
        isActive: input.isActive ?? true,
        lastSeenAt: new Date(),
      },
    });
  }

  return prisma.providerEntityMapping.create({
    data: {
      vendorId: input.vendorId,
      connectionId: input.connectionId ?? null,
      provider: input.provider,
      internalEntityType: input.internalEntityType,
      internalEntityId: input.internalEntityId,
      externalId: input.externalId,
      externalLocationId,
      externalPayloadHash: input.externalPayloadHash ?? null,
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
