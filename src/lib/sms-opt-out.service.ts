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
  const normalized = normalizeUsPhoneToE164(trimmed);
  if (normalized) return normalized;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[2-9]\d{9}$/.test(last10)) return `+1${last10}`;
  }
  return null;
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
