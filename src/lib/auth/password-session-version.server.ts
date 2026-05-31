import "server-only";

import { prisma } from "@/lib/db";
import { passwordChangedAtToJwtMs } from "@/lib/auth/password-session-version";

export async function loadUserPasswordChangedAtMs(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });
  return passwordChangedAtToJwtMs(user?.passwordChangedAt);
}
