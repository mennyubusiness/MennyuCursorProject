import "server-only";

import { prisma } from "@/lib/db";
import { emailVerifiedToJwtMs } from "@/lib/auth/email-verification-session";

export async function loadUserEmailVerifiedMs(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, disabledAt: true },
  });
  if (user?.disabledAt) return null;
  return emailVerifiedToJwtMs(user?.emailVerified);
}
