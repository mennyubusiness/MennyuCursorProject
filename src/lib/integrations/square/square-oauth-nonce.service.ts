import "server-only";

import { prisma } from "@/lib/db";

export class SquareOAuthStateReplayError extends Error {
  constructor() {
    super("oauth_state_reused");
    this.name = "SquareOAuthStateReplayError";
  }
}

export async function consumeSquareOAuthStateNonce(input: {
  nonce: string;
  vendorId: string;
  userId: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    await prisma.integrationOAuthStateNonce.create({
      data: {
        nonce: input.nonce,
        vendorId: input.vendorId,
        userId: input.userId,
        expiresAt: input.expiresAt,
      },
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      throw new SquareOAuthStateReplayError();
    }
    throw e;
  }
}

/** Best-effort cleanup of expired nonces (safe to skip on failure). */
export async function pruneExpiredSquareOAuthStateNonces(): Promise<void> {
  await prisma.integrationOAuthStateNonce
    .deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    .catch(() => {
      /* non-critical */
    });
}
