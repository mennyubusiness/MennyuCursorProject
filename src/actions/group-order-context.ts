"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { resolveActorForGroupCart, type ResolvedGroupCartActor } from "@/services/group-order.service";

export async function resolveGroupOrderActorForCartMutation(cartId: string): Promise<ResolvedGroupCartActor | null> {
  const session = await auth();
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  return resolveActorForGroupCart(cartId, {
    hostUserId: session?.user?.id ?? null,
    participantIdFromCookie: markers.participantId,
    joinTokenFromCookie: markers.legacyJoinToken,
  });
}
