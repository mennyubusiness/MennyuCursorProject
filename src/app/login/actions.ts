"use server";

import { revalidatePath } from "next/cache";

import { auth, signOut } from "@/auth";
import { resolveAccountCartOwnershipOnSignIn } from "@/lib/account-cart-ownership";
import { getPostLogoutRedirect } from "@/lib/auth/customer-safe-paths";
import {
  resolvePostLoginDestination,
  type PostLoginDestinationResult,
} from "@/lib/auth/post-login-destination";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";

export async function resolvePostLoginDestinationAction(
  returnPath: string | null
): Promise<PostLoginDestinationResult | { kind: "error"; message: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "Session not found. Try signing in again." };
  }

  const mennyuSessionId = await getMennyuSessionIdForRequest();
  if (mennyuSessionId) {
    await resolveAccountCartOwnershipOnSignIn(session.user.id, mennyuSessionId);
  }

  revalidatePath("/", "layout");
  return resolvePostLoginDestination(session.user.id, returnPath);
}
