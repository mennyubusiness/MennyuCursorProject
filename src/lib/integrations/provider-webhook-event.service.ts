import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  IntegrationProvider,
  ProviderWebhookProcessingStatus,
} from "@/lib/integrations/types";

export type LogProviderWebhookEventInput = {
  provider: IntegrationProvider;
  connectionId?: string | null;
  vendorId?: string | null;
  externalEventId?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  payload?: unknown;
  processingStatus?: ProviderWebhookProcessingStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  relatedOrderId?: string | null;
  relatedVendorOrderId?: string | null;
};

function sanitizePayload(payload: unknown): Prisma.InputJsonValue | undefined {
  if (payload == null) return undefined;
  if (typeof payload !== "object") return undefined;
  try {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    for (const secretKey of [
      "authorization",
      "access_token",
      "refresh_token",
      "client_secret",
      "password",
      "secret",
    ]) {
      if (secretKey in clone) clone[secretKey] = "[REDACTED]";
    }
    return clone as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function payloadHash(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  try {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  } catch {
    return undefined;
  }
}

export type LogProviderWebhookEventResult =
  | { created: true; id: string }
  | { created: false; id: string; reason: "duplicate_external_event_id" };

/**
 * Idempotent when externalEventId is present (unique on provider + externalEventId).
 */
export async function logProviderWebhookEvent(
  input: LogProviderWebhookEventInput
): Promise<LogProviderWebhookEventResult> {
  const externalEventId = input.externalEventId?.trim() || null;

  if (externalEventId) {
    const existing = await prisma.providerWebhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: input.provider,
          externalEventId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { created: false, id: existing.id, reason: "duplicate_external_event_id" };
    }
  }

  const row = await prisma.providerWebhookEvent.create({
    data: {
      provider: input.provider,
      connectionId: input.connectionId ?? null,
      vendorId: input.vendorId ?? null,
      externalEventId,
      externalObjectId: input.externalObjectId?.trim() || null,
      eventType: input.eventType,
      payloadHash: payloadHash(input.payload),
      sanitizedPayloadJson: sanitizePayload(input.payload),
      processingStatus: input.processingStatus ?? "received",
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      relatedOrderId: input.relatedOrderId ?? null,
      relatedVendorOrderId: input.relatedVendorOrderId ?? null,
    },
    select: { id: true },
  });

  return { created: true, id: row.id };
}

export async function markProviderWebhookEventProcessed(
  id: string,
  status: ProviderWebhookProcessingStatus,
  error?: { code?: string; message?: string }
) {
  return prisma.providerWebhookEvent.update({
    where: { id },
    data: {
      processingStatus: status,
      processedAt: new Date(),
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
    },
  });
}
