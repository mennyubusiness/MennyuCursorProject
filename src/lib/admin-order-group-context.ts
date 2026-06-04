/**
 * Admin support view model for group orders (read-only attribution).
 */
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import { effectiveLineParticipantId } from "@/lib/group-order-cart-read-model";
import { formatMaskedCustomerPhone } from "@/lib/phone";

export type AdminGroupOrderParticipantRow = {
  id: string;
  role: "host" | "participant";
  displayName: string;
  phoneMasked: string | null;
  userEmail: string | null;
  leftAt: Date | null;
};

export type AdminOrderGroupContext = {
  sessionId: string;
  joinCode: string;
  status: string;
  lockedAt: Date | null;
  expiresAt: Date;
  sessionCreatedAt: Date;
  hostUserId: string;
  hostUserName: string | null;
  hostUserEmail: string | null;
  hostParticipantId: string;
  hostDisplayName: string;
  participantCount: number;
  activeParticipantCount: number;
  participants: AdminGroupOrderParticipantRow[];
  participantById: Map<string, AdminGroupOrderParticipantRow>;
};

function formatGroupOrderStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function formatAdminGroupOrderStatus(status: string): string {
  const label = formatGroupOrderStatus(status);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildAdminOrderGroupContext(
  detail: AdminOrderDetail
): AdminOrderGroupContext | null {
  const session = detail.groupOrderSession;
  if (!detail.groupOrderSessionId || !session) return null;

  const hostParticipant = session.participants.find((p) => p.role === "host");
  if (!hostParticipant) return null;

  const participants: AdminGroupOrderParticipantRow[] = session.participants.map((p) => ({
    id: p.id,
    role: p.role,
    displayName: p.displayName,
    phoneMasked: p.phoneE164 ? formatMaskedCustomerPhone(p.phoneE164) : null,
    userEmail: p.user?.email?.trim() || null,
    leftAt: p.leftAt,
  }));

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const activeParticipantCount = participants.filter((p) => !p.leftAt).length;

  return {
    sessionId: session.id,
    joinCode: session.joinCode,
    status: session.status,
    lockedAt: session.lockedAt,
    expiresAt: session.expiresAt,
    sessionCreatedAt: session.createdAt,
    hostUserId: session.host.id,
    hostUserName: session.host.name?.trim() || null,
    hostUserEmail: session.host.email?.trim() || null,
    hostParticipantId: hostParticipant.id,
    hostDisplayName: hostParticipant.displayName,
    participantCount: participants.length,
    activeParticipantCount,
    participants,
    participantById,
  };
}

/** Short label for line items and refund rows (e.g. "For Alex", "Host"). */
export function adminGroupOrderLineAttributionLabel(
  groupOrderParticipantId: string | null,
  ctx: AdminOrderGroupContext
): string {
  const pid = effectiveLineParticipantId(groupOrderParticipantId, ctx.hostParticipantId);
  const row = ctx.participantById.get(pid);
  if (!row) return "Unknown participant";
  if (row.role === "host") {
    return row.displayName.trim() === ctx.hostDisplayName.trim() ? "Host" : `Host · ${row.displayName}`;
  }
  return `For ${row.displayName}`;
}

/** Line label for refund UI (e.g. "Pizza × 1 · For Alex"). */
export function adminGroupOrderRefundLineDescription(
  name: string,
  quantity: number,
  groupOrderParticipantId: string | null,
  ctx: AdminOrderGroupContext | null | undefined
): string {
  const base = `${name} × ${quantity}`;
  if (!ctx) return base;
  return `${base} · ${adminGroupOrderLineAttributionLabel(groupOrderParticipantId, ctx)}`;
}
