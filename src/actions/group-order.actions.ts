"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { auth } from "@/auth";
import {
  readGroupOrderParticipantMarkers,
  setGroupOrderParticipantCookies,
  clearGroupOrderParticipantCookies,
} from "@/lib/group-order-participant-cookie";
import {
  RATE_LIMITS,
  RATE_LIMIT_ERROR_MESSAGE,
  enforceRateLimits,
  rateLimitKeys,
} from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/rate-limit-http";
import {
  joinGroupOrderSession,
  leaveGroupOrderAsParticipant,
  endGroupOrderAsHost,
  unlockGroupOrderSessionFromCheckout,
} from "@/services/group-order.service";
import { getCartById } from "@/services/cart.service";
import {
  getGroupOrderStateForCartPage,
  startGroupOrderForCartPage,
} from "@/lib/group-order-cart-page";

export async function startGroupOrderFormAction(formData: FormData) {
  const cartId = String(formData.get("cartId") ?? "").trim();
  const podId = String(formData.get("podId") ?? "").trim();
  if (!cartId || !podId) {
    redirect(`/cart?groupError=${encodeURIComponent("Missing cart.")}`);
  }
  const result = await startGroupOrderFromCartAction(cartId, podId);
  if (!result.success) {
    redirect(`/cart?groupError=${encodeURIComponent(result.error)}`);
  }
  redirect("/cart");
}

export async function startGroupOrderFromCartAction(cartId: string, podId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Sign in to start a group order." };
  }
  const name = session.user.name?.trim() || "Host";
  const result = await startGroupOrderForCartPage(cartId, podId, session.user.id, name);
  if (result.success) {
    const store = await cookies();
    const { clearStaleGroupParticipantCookiesForNewHostGroup } = await import(
      "@/lib/group-order-host-cookie-cleanup"
    );
    await clearStaleGroupParticipantCookiesForNewHostGroup(store, {
      hostUserId: session.user.id,
      activeSessionId: result.sessionId,
      activeSessionCartId: cartId,
    });
    revalidatePath("/cart");
    revalidatePath(`/pod/${podId}`, "layout");
  }
  return result;
}

export async function joinGroupOrderFormAction(formData: FormData) {
  const groupOrderSessionId = String(formData.get("groupOrderSessionId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const joinAttemptKey = String(formData.get("joinAttemptKey") ?? "").trim();
  const res = await joinGroupOrderAction({ groupOrderSessionId, displayName, phone, joinAttemptKey });
  if (res.success) {
    redirect(`/pod/${res.podId}`, RedirectType.replace);
  }
  redirect(`/group-order/join?session=${encodeURIComponent(groupOrderSessionId)}&error=${encodeURIComponent(res.error)}`);
}

export async function joinGroupOrderAction(input: {
  groupOrderSessionId: string;
  displayName: string;
  phone: string;
  joinAttemptKey?: string;
}) {
  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const authSession = await auth();
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  const limited = enforceRateLimits([
    {
      key: rateLimitKeys.groupJoinIp(ip),
      ...RATE_LIMITS.groupJoinIp,
    },
    {
      key: rateLimitKeys.groupJoinSession(input.groupOrderSessionId.trim()),
      ...RATE_LIMITS.groupJoinSession,
    },
  ]);
  if (limited) {
    return { success: false as const, error: RATE_LIMIT_ERROR_MESSAGE };
  }

  try {
    const result = await joinGroupOrderSession({
      groupOrderSessionId: input.groupOrderSessionId,
      displayName: input.displayName,
      phoneRaw: input.phone,
      participantIdFromCookie: markers.participantId,
      joinTokenFromCookie: markers.legacyJoinToken,
      joinAttemptKey: input.joinAttemptKey || null,
      userId: authSession?.user?.id ?? null,
    });
    setGroupOrderParticipantCookies(store, {
      participantId: result.participantId,
      podId: result.podId,
    });
    revalidatePath("/cart");
    revalidatePath(`/pod/${result.podId}`, "layout");
    return { success: true as const, cartId: result.cartId, podId: result.podId };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Could not join." };
  }
}

export async function leaveGroupOrderAction() {
  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  const { resolveActiveGroupParticipantBinding } = await import(
    "@/lib/group-order-participant-resolve"
  );
  const binding = await resolveActiveGroupParticipantBinding(markers);
  if (!binding) return { success: false as const, error: "Not in a group order." };
  await leaveGroupOrderAsParticipant(binding.participantId);
  clearGroupOrderParticipantCookies(store);
  revalidatePath("/cart");
  return { success: true as const };
}

export async function leaveGroupOrderFormAction() {
  const r = await leaveGroupOrderAction();
  if (!r.success) {
    redirect(`/cart?groupError=${encodeURIComponent(r.error)}`);
  }
  redirect("/explore");
}

export async function endGroupOrderHostFormAction(formData: FormData) {
  const cartId = String(formData.get("cartId") ?? "").trim();
  if (!cartId) redirect("/cart?groupError=Missing+cart.");
  const r = await endGroupOrderHostAction(cartId);
  if (!r.success) {
    redirect(`/cart?groupError=${encodeURIComponent(r.error ?? "Could not end group order.")}`);
  }
  redirect("/cart");
}

export async function endGroupOrderHostAction(cartId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Unauthorized." };
  await endGroupOrderAsHost(cartId, session.user.id);
  revalidatePath("/cart");
  return { success: true as const };
}

export async function unlockGroupCheckoutAction(cartId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const };
  await unlockGroupOrderSessionFromCheckout(cartId, session.user.id);
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { success: true as const };
}

export async function getGroupOrderStateAction(cartId: string) {
  return getGroupOrderStateForCartPage(cartId);
}

export async function getCartForGroupOrderAction(cartId: string) {
  return getCartById(cartId);
}
