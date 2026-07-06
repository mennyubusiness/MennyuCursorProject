import "server-only";

import type { IntegrationProvider } from "@/lib/integrations/types";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  IntegrationTokenEncryptionNotConfiguredError,
} from "@/lib/integrations/integration-token-crypto";
import { prisma } from "@/lib/db";

export type StoreIntegrationTokensInput = {
  vendorId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
};

export type IntegrationTokenBundle = {
  credentialId: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
};

export async function storeIntegrationProviderTokens(
  input: StoreIntegrationTokensInput
): Promise<{ credentialId: string }> {
  const encryptedAccessToken = encryptIntegrationSecret(input.accessToken);
  const encryptedRefreshToken = input.refreshToken
    ? encryptIntegrationSecret(input.refreshToken)
    : null;

  const row = await prisma.integrationProviderCredential.create({
    data: {
      vendorId: input.vendorId,
      provider: input.provider,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
    },
    select: { id: true },
  });

  return { credentialId: row.id };
}

export async function updateIntegrationProviderTokens(
  credentialId: string,
  input: Omit<StoreIntegrationTokensInput, "vendorId" | "provider">
): Promise<void> {
  await prisma.integrationProviderCredential.update({
    where: { id: credentialId },
    data: {
      encryptedAccessToken: encryptIntegrationSecret(input.accessToken),
      encryptedRefreshToken: input.refreshToken
        ? encryptIntegrationSecret(input.refreshToken)
        : null,
      accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
    },
  });
}

export async function loadIntegrationProviderTokens(
  credentialId: string
): Promise<IntegrationTokenBundle | null> {
  const row = await prisma.integrationProviderCredential.findUnique({
    where: { id: credentialId },
    select: {
      id: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      accessTokenExpiresAt: true,
    },
  });
  if (!row) return null;

  return {
    credentialId: row.id,
    accessToken: decryptIntegrationSecret(row.encryptedAccessToken),
    refreshToken: row.encryptedRefreshToken
      ? decryptIntegrationSecret(row.encryptedRefreshToken)
      : null,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
  };
}

export async function deleteIntegrationProviderCredential(credentialId: string): Promise<void> {
  await prisma.integrationProviderCredential.delete({ where: { id: credentialId } }).catch(() => {
    /* already removed */
  });
}

export { IntegrationTokenEncryptionNotConfiguredError };
