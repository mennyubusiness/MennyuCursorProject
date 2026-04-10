"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE } from "@/lib/group-order-cookies";
import { resolveActorForGroupCart, type ResolvedGroupCartActor } from "@/services/group-order.service";

export async function resolveGroupOrderActorForCartMutation(cartId: string): Promise<ResolvedGroupCartActor | null> {
  const session = await auth();
  const store = await cookies();
  const join = store.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;
  return resolveActorForGroupCart(cartId, {
    hostUserId: session?.user?.id ?? null,
    joinTokenFromCookie: join,
  });
}
