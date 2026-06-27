import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      /** Set at sign-in; re-login after DB role change to refresh. */
      isPlatformAdmin?: boolean;
      /** Derived from User.emailVerified at sign-in; refreshed on JWT callback. */
      isEmailVerified?: boolean;
    };
  }

  interface User {
    isPlatformAdmin?: boolean;
    passwordChangedAt?: Date | null;
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    isPlatformAdmin?: boolean;
    /** User.passwordChangedAt at sign-in (ms since epoch); null = never reset. */
    passwordChangedAtMs?: number | null;
    emailVerifiedMs?: number | null;
    sessionInvalidated?: boolean;
  }
}
