"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  /** Server session — avoids a client round-trip and reduces nav flicker after load. */
  session?: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
