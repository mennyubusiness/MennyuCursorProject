"use server";

import { revalidatePath } from "next/cache";

import { auth, signOut } from "@/auth";
import { getPostLogoutRedirect } from "@/lib/auth/customer-safe-paths";
import { rotateMennyuSessionForSignOut } from "@/lib/session-request";
import { prisma } from "@/lib/db";

export type UpdateAccountNameResult = { ok: true } | { ok: false; error: string };

/** Clears NextAuth User session, revalidates auth-dependent layout, redirects contextually. */
export async function signOutAccountAction(formData: FormData): Promise<void> {
  const rawPath = formData.get("returnPath");
  const returnPath = typeof rawPath === "string" ? rawPath : null;
  const redirectTo = getPostLogoutRedirect(returnPath);

  await rotateMennyuSessionForSignOut();
  revalidatePath("/", "layout");
  await signOut({ redirectTo });
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

  revalidatePath("/", "layout");

  return { ok: true };
}
