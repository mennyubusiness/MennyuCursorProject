"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE, GROUP_ORDER_JOIN_COOKIE_MAX_AGE_SEC } from "@/lib/group-order-cookies";
import {
  startGroupOrderSession,
  joinGroupOrderSession,
  leaveGroupOrderAsParticipant,
  endGroupOrderAsHost,
  unlockGroupOrderSessionFromCheckout,
  listParticipantsPublicForHost,
  findSessionByCartId,
} from "@/services/group-order.service";
import { getCartById } from "@/services/cart.service";

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
  try {
    const { sessionId, joinCode } = await startGroupOrderSession({
      hostUserId: session.user.id,
      cartId,
      podId,
      hostDisplayName: name,
    });
    revalidatePath("/cart");
    revalidatePath(`/pod/${podId}`, "layout");
    return { success: true as const, sessionId, joinCode };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "GROUP_ORDER_SESSION_EXISTS") {
      return { success: false as const, error: "This cart already has a group order." };
    }
    return { success: false as const, error: msg };
  }
}

export async function joinGroupOrderFormAction(formData: FormData) {
  const groupOrderSessionId = String(formData.get("groupOrderSessionId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const res = await joinGroupOrderAction({ groupOrderSessionId, displayName, phone });
  if (res.success) {
    redirect(`/pod/${res.podId}`);
  }
  redirect(`/group-order/join?session=${encodeURIComponent(groupOrderSessionId)}&error=${encodeURIComponent(res.error)}`);
}

export async function joinGroupOrderAction(input: {
  groupOrderSessionId: string;
  displayName: string;
  phone: string;
}) {
  try {
    const result = await joinGroupOrderSession({
      groupOrderSessionId: input.groupOrderSessionId,
      displayName: input.displayName,
      phoneRaw: input.phone,
    });
    const store = await cookies();
    store.set(GROUP_ORDER_JOIN_TOKEN_COOKIE, result.joinToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: GROUP_ORDER_JOIN_COOKIE_MAX_AGE_SEC,
      secure: process.env.NODE_ENV === "production",
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
  const token = store.get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value;
  if (!token) return { success: false as const, error: "Not in a group order." };
  const { prisma } = await import("@/lib/db");
  const p = await prisma.groupOrderParticipant.findFirst({
    where: { joinToken: token, leftAt: null, role: "participant" },
    select: { id: true },
  });
  if (!p) return { success: false as const, error: "Not in a group order." };
  await leaveGroupOrderAsParticipant(p.id);
  store.delete(GROUP_ORDER_JOIN_TOKEN_COOKIE);
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
  const authSession = await auth();
  const hostId = authSession?.user?.id ?? null;
  const s = await findSessionByCartId(cartId);
  if (!s) return { active: false as const };
  const data = await listParticipantsPublicForHost(cartId);
  if (!data) return { active: false as const };
  return {
    active: true as const,
    ...data,
    isHost: Boolean(hostId && s.hostUserId === hostId),
  };
}

export async function getCartForGroupOrderAction(cartId: string) {
  return getCartById(cartId);
}
