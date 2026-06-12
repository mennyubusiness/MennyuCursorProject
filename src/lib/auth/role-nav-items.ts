import {
  ACCOUNT_HUB_PATH,
  ORDER_HISTORY_PATH,
} from "@/lib/auth/account-paths";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";

export type RoleAccountAction =
  | { type: "link"; href: string; label: string; danger?: boolean }
  | { type: "sign-out"; label: string; danger?: boolean };

export type RoleNavConfig = {
  showBusinessCta: boolean;
  /** Server-side cart eligibility; guest users also need an active cart client-side. */
  showCartForSession: boolean;
  accountActions: RoleAccountAction[];
};

export function resolvePrimaryNavModeFromMemberships(input: {
  isPlatformAdmin: boolean;
  vendorCount: number;
  podCount: number;
}): Exclude<HeaderNavMode, "guest" | "customer"> | "customer" {
  if (input.isPlatformAdmin) return "admin";
  if (input.vendorCount > 0) return "vendor";
  if (input.podCount > 0) return "pod";
  return "customer";
}

export function shouldShowHeaderCart(input: {
  navMode: HeaderNavMode;
  hasActiveCart: boolean;
}): boolean {
  if (input.navMode === "vendor" || input.navMode === "pod" || input.navMode === "admin") {
    return false;
  }
  if (input.navMode === "customer") {
    return true;
  }
  return input.hasActiveCart;
}

export function buildRoleAccountActions(input: {
  mode: HeaderNavMode;
  accountMenu: HeaderAccountMenu;
  dashboardHref: string | null;
}): RoleAccountAction[] {
  const { mode, accountMenu, dashboardHref } = input;
  const actions: RoleAccountAction[] = [];
  const secondary: RoleAccountAction[] = [];

  const accountLabel =
    mode === "vendor"
      ? "Vendor account"
      : mode === "pod"
        ? "Pod account"
        : mode === "admin"
          ? "Admin account"
          : "Account";

  actions.push({ type: "link", href: ACCOUNT_HUB_PATH, label: accountLabel });

  switch (mode) {
    case "customer":
      actions.push({ type: "link", href: ORDER_HISTORY_PATH, label: "Orders" });
      break;
    case "vendor":
      if (dashboardHref) {
        actions.push({ type: "link", href: dashboardHref, label: "Vendor dashboard" });
      }
      if (accountMenu.vendorOrdersHref) {
        actions.push({ type: "link", href: accountMenu.vendorOrdersHref, label: "Orders" });
      }
      if (accountMenu.vendorKitchenHref) {
        actions.push({ type: "link", href: accountMenu.vendorKitchenHref, label: "Kitchen mode" });
      }
      if (accountMenu.vendorSettingsHref) {
        actions.push({ type: "link", href: accountMenu.vendorSettingsHref, label: "Settings" });
      }
      break;
    case "pod":
      if (dashboardHref) {
        actions.push({ type: "link", href: dashboardHref, label: "Pod dashboard" });
      }
      if (accountMenu.podSettingsHref) {
        actions.push({ type: "link", href: accountMenu.podSettingsHref, label: "Pod settings" });
      }
      if (accountMenu.podVendorsHref) {
        actions.push({ type: "link", href: accountMenu.podVendorsHref, label: "Manage vendors" });
      }
      break;
    case "admin":
      if (accountMenu.adminDashboardHref) {
        actions.push({
          type: "link",
          href: accountMenu.adminDashboardHref,
          label: "Platform admin",
        });
      }
      break;
    default:
      break;
  }

  if (mode !== "admin" && accountMenu.adminDashboardHref) {
    secondary.push({
      type: "link",
      href: accountMenu.adminDashboardHref,
      label: "Platform admin",
    });
  }

  if (mode !== "vendor") {
    if (accountMenu.vendorDashboardHref && accountMenu.vendorDashboardLabel) {
      secondary.push({
        type: "link",
        href: accountMenu.vendorDashboardHref,
        label: accountMenu.vendorDashboardLabel,
      });
    } else if (accountMenu.vendorSelectHref) {
      secondary.push({
        type: "link",
        href: accountMenu.vendorSelectHref,
        label: "Vendor dashboards",
      });
    }
  }

  if (mode !== "pod") {
    if (accountMenu.podDashboardHref && accountMenu.podDashboardLabel) {
      secondary.push({
        type: "link",
        href: accountMenu.podDashboardHref,
        label: accountMenu.podDashboardLabel,
      });
    } else if (accountMenu.podSelectHref) {
      secondary.push({
        type: "link",
        href: accountMenu.podSelectHref,
        label: "Pod dashboards",
      });
    }
  }

  actions.push(...secondary);
  actions.push({ type: "sign-out", label: "Sign out", danger: true });

  return actions;
}

export function buildRoleNavConfig(input: {
  mode: HeaderNavMode;
  accountMenu: HeaderAccountMenu | null;
  dashboardHref: string | null;
}): RoleNavConfig {
  const { mode, accountMenu, dashboardHref } = input;

  if (mode === "guest") {
    return {
      showBusinessCta: true,
      showCartForSession: false,
      accountActions: [],
    };
  }

  if (!accountMenu) {
    return {
      showBusinessCta: false,
      showCartForSession: mode === "customer",
      accountActions: [],
    };
  }

  const accountActions = buildRoleAccountActions({
    mode,
    accountMenu,
    dashboardHref,
  });

  return {
    showBusinessCta: false,
    showCartForSession: mode === "customer",
    accountActions,
  };
}
