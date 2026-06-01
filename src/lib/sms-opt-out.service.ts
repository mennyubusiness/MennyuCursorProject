/**
 * TCPA SMS opt-out registry (STOP / START keywords).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { isLikelyE164Phone, normalizeUsPhoneToE164 } from "@/lib/phone";

export function normalizeSmsPhoneE164(raw: string): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (isLikelyE164Phone(trimmed)) return trimmed;
  return normalizeUsPhoneToE164(trimmed);
}

export async function isPhoneSmsOptedOut(phoneE164: string): Promise<boolean> {
  const row = await prisma.smsOptOut.findUnique({
    where: { phoneE164 },
    select: { optedOutAt: true, optedInAt: true },
  });
  if (!row?.optedOutAt) return false;
  if (row.optedInAt && row.optedInAt > row.optedOutAt) return false;
  return true;
}

export async function recordSmsOptOut(phoneE164: string): Promise<void> {
  const now = new Date();
  await prisma.smsOptOut.upsert({
    where: { phoneE164 },
    create: { phoneE164, optedOutAt: now, optedInAt: null },
    update: { optedOutAt: now },
  });
}

export async function recordSmsOptIn(phoneE164: string): Promise<void> {
  const now = new Date();
  await prisma.smsOptOut.upsert({
    where: { phoneE164 },
    create: { phoneE164, optedInAt: now, optedOutAt: null },
    update: { optedInAt: now, optedOutAt: null },
  });
}
