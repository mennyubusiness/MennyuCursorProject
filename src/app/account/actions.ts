"use server";

import { signOut } from "@/auth";
import { SIGN_IN_PATH } from "@/lib/auth/account-paths";

/** Clears NextAuth User session and redirects to sign-in. */
export async function signOutAccountAction(): Promise<void> {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
