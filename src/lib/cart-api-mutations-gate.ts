import "server-only";

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const CART_API_MUTATIONS_DISABLED_CODE = "CART_API_MUTATIONS_DISABLED" as const;

export const CART_API_MUTATIONS_DISABLED_MESSAGE =
  "Cart API mutations are disabled. Use cart actions.";

/** Legacy REST cart line mutations; first-party UI uses cart.actions Server Actions. */
export function isCartApiMutationsEnabled(): boolean {
  return env.ENABLE_CART_API_MUTATIONS === "true";
}

export function rejectDisabledCartApiMutation(
  method: "POST" | "PATCH" | "DELETE"
): NextResponse {
  console.warn(
    JSON.stringify({
      event: "cart_api_mutation_disabled",
      scope: "api_cart",
      method,
    })
  );
  return NextResponse.json(
    {
      error: CART_API_MUTATIONS_DISABLED_MESSAGE,
      code: CART_API_MUTATIONS_DISABLED_CODE,
    },
    { status: 410 }
  );
}
