import "server-only";

import { prisma } from "@/lib/db";
import { passwordChangedAtToJwtMs } from "@/lib/auth/password-session-version";

export async function loadUserPasswordChangedAtMs(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true, disabledAt: true },
  });
  if (user?.disabledAt) return Date.now();
  return passwordChangedAtToJwtMs(user?.passwordChangedAt);
}

export async function loadUserDisabledAt(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabledAt: true },
  });
  return user?.disabledAt ?? null;
}
