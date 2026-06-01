"use client";

import { useEffect } from "react";
import type { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";

function SessionServerSync({
  hasServerSession,
  children,
}: {
  hasServerSession: boolean;
  children: React.ReactNode;
}) {
  const { status } = useSession();

  useEffect(() => {
    if (!hasServerSession && status === "authenticated") {
      void signOut({ redirect: false });
    }
  }, [hasServerSession, status]);

  return children;
}

export function AuthSessionProvider({
  children,
  session,
  hasServerSession,
}: {
  children: React.ReactNode;
  /** Server session — avoids a client round-trip and reduces nav flicker after load. */
  session?: Session | null;
  hasServerSession: boolean;
}) {
  return (
    <SessionProvider session={session}>
      <SessionServerSync hasServerSession={hasServerSession}>{children}</SessionServerSync>
    </SessionProvider>
  );
}
