import { buildLoginHrefWithReturn, SIGN_IN_PATH } from "@/lib/auth/login-return-path";

export { SIGN_IN_PATH };

/** Shared route constants (client + server safe). */
export const ACCOUNT_HUB_PATH = "/account";
export const ORDER_HISTORY_PATH = "/orders";
export const ACCOUNT_SIGN_IN_PATH = buildLoginHrefWithReturn("/account");
export const ORDERS_SIGN_IN_PATH = buildLoginHrefWithReturn("/orders");
export const CUSTOMER_REGISTER_PATH = "/register";

export const ACCOUNT_ROLE_PATH = "/account/role";
export const ACCOUNT_SETUP_CUSTOMER_PATH = "/account/setup/customer";
export const ACCOUNT_SETUP_VENDOR_PATH = "/account/setup/vendor";
export const ACCOUNT_SETUP_POD_PATH = "/account/setup/pod";

/** Client-safe label for a pending onboarding destination path. */
export function getPendingOnboardingLabel(path: string): string {
  const clean = path.split("?")[0]?.trim() ?? path;
  if (clean === ACCOUNT_ROLE_PATH) return "Choose account type";
  if (clean === ACCOUNT_SETUP_VENDOR_PATH) return "Continue vendor setup";
  if (clean === ACCOUNT_SETUP_POD_PATH) return "Continue pod setup";
  if (clean === ACCOUNT_SETUP_CUSTOMER_PATH) return "Complete your profile";
  return "Continue setup";
}
