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
    };
  }

  interface User {
    isPlatformAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    isPlatformAdmin?: boolean;
  }
}
