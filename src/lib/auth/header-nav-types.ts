/** Shared types for global header — safe to import from client components. */

import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";

export type { HeaderAccountMenu };

export type HeaderNavMode = "guest" | "customer" | "vendor" | "pod" | "admin";

export type HeaderNavContext = {
  mode: HeaderNavMode;
  dashboardHref: string | null;
  accountLabel: string | null;
  /** Populated when signed in — drives the Account header dropdown. */
  accountMenu: HeaderAccountMenu | null;
};
