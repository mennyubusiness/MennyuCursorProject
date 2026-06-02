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
