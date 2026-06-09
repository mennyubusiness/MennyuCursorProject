"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import {
  resolveActorForGroupCart,
  resolveGroupCartActorForRead,
  type ResolvedGroupCartActor,
} from "@/services/group-order.service";

async function readParticipantMarkers() {
  const store = await cookies();
  return readGroupOrderParticipantMarkers(store);
}

export async function resolveGroupOrderActorForCartRead(
  cartId: string
): Promise<ResolvedGroupCartActor | null> {
  const session = await auth();
  const markers = await readParticipantMarkers();
  return resolveGroupCartActorForRead(cartId, {
    hostUserId: session?.user?.id ?? null,
    participantIdFromCookie: markers.participantId,
    joinTokenFromCookie: markers.legacyJoinToken,
  });
}

export async function resolveGroupOrderActorForCartMutation(cartId: string): Promise<ResolvedGroupCartActor | null> {
  const session = await auth();
  const markers = await readParticipantMarkers();
  return resolveActorForGroupCart(cartId, {
    hostUserId: session?.user?.id ?? null,
    participantIdFromCookie: markers.participantId,
    joinTokenFromCookie: markers.legacyJoinToken,
  });
}
