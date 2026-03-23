/**
 * Unified Auth.js (NextAuth v5) — credentials + JWT session cookie.
 * Phase 1: vendor access via VendorMembership; platform admin via User.isPlatformAdmin (JWT);
 * legacy vendorDashboardToken + ADMIN_SECRET cookie bridge remain for migration.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

function authSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return "dev-only-auth-secret-min-32-chars!!!!";
  }
  throw new Error("AUTH_SECRET must be set in production (min 32 characters).");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret(),
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const passwordRaw = credentials?.password;
        if (!emailRaw || !passwordRaw || typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
          return null;
        }
        const email = emailRaw.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, isPlatformAdmin: true },
        });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(passwordRaw, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isPlatformAdmin = Boolean(user.isPlatformAdmin);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
      }
      return session;
    },
  },
});
