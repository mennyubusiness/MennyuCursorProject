"use client";

import { useEffect, useRef } from "react";
import type { Session } from "next-auth";
import { SessionProvider, signOut, useSession } from "next-auth/react";

/**
 * After server sign-out, the JWT cookie is cleared but the client SessionProvider can
 * still report `authenticated` until signOut runs. Only clear the client session when the
 * server session transitions from present → absent — not on initial load or right after
 * sign-in (when the client updates before `router.refresh()`).
 */
function SessionServerSync({
  hasServerSession,
  children,
}: {
  hasServerSession: boolean;
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const hadServerSessionRef = useRef(hasServerSession);

  useEffect(() => {
    const hadServerSession = hadServerSessionRef.current;
    hadServerSessionRef.current = hasServerSession;

    if (hadServerSession && !hasServerSession && status === "authenticated") {
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
