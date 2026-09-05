import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";

const REGISTER_PATH = "/register";

export function buildRegisterHrefWithReturn(
  returnPath: string,
  intent?: "vendor" | "pod_owner"
): string {
  const loginHref = buildLoginHrefWithReturn(returnPath);
  const params = new URLSearchParams(loginHref.split("?")[1] ?? "");
  if (intent === "vendor" || intent === "pod_owner") {
    params.set("intent", intent);
  }
  const query = params.toString();
  return query ? `${REGISTER_PATH}?${query}` : REGISTER_PATH;
}

export { buildLoginHrefWithReturn };
