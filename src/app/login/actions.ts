"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  resolvePostLoginDestination,
  type PostLoginDestinationResult,
} from "@/lib/auth/post-login-destination";

export async function resolvePostLoginDestinationAction(
  callbackUrl: string | null
): Promise<PostLoginDestinationResult | { kind: "error"; message: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { kind: "error", message: "Session not found. Try signing in again." };
  }
  revalidatePath("/", "layout");
  return resolvePostLoginDestination(session.user.id, callbackUrl);
}
