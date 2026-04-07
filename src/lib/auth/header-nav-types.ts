/** Shared types for global header — safe to import from client components. */

export type HeaderNavMode = "guest" | "customer" | "vendor" | "pod" | "admin";

export type HeaderNavContext = {
  mode: HeaderNavMode;
  dashboardHref: string | null;
  accountLabel: string | null;
};
