"use server";

import { revalidatePath } from "next/cache";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { SIGN_IN_PATH } from "@/lib/auth/account-paths";

export type UpdateAccountNameResult = { ok: true } | { ok: false; error: string };

/** Clears NextAuth User session, revalidates auth-dependent layout, redirects to sign-in. */
export async function signOutAccountAction(): Promise<void> {
  revalidatePath("/", "layout");
  await signOut({ redirectTo: SIGN_IN_PATH });
}

export async function updateAccountNameAction(name: string): Promise<UpdateAccountNameResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in to update your profile." };
  }

  const trimmed = name.trim();
  if (trimmed.length > 120) {
    return { ok: false, error: "Name must be 120 characters or fewer." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name: trimmed || null },
  });

  return { ok: true };
}
