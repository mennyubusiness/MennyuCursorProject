/**
 * Read model for collaborative group-order cart UI — display-only slices of cart math.
 * Tip preview uses the same default % as checkout (see CheckoutForm TIP preset default).
 */
import { splitProRata } from "@/domain/money";

/** Matches checkout default tip preset before host changes it (CheckoutForm initial state). */
export const GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT = 20;

export function tipCentsForPercentPreview(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}

export type GroupOrderParticipantInput = {
  id: string;
  displayName: string;
  isHost: boolean;
};

export type GroupOrderCartLineInput = {
  id: string;
  priceCents: number;
  quantity: number;
  groupOrderParticipantId: string | null;
};

export type GroupOrderParticipantRow = {
  participantId: string;
  displayName: string;
  isHost: boolean;
  subtotalCents: number;
  /** Share of {@link illustrativeTotalTipCents} using the same pro-rata as food subtotals. */
  illustrativeTipShareCents: number;
};

export type GroupOrderCartReadModel = {
  groupFoodSubtotalCents: number;
  /** Example total tip if host leaves checkout at the default % on current food subtotal. */
  illustrativeTotalTipCents: number;
  participantRows: GroupOrderParticipantRow[];
  hostParticipantId: string;
};

/**
 * Effective owner for a line: unattributed lines in a group cart are treated as the host's
 * (legacy or migration edge cases).
 */
export function effectiveLineParticipantId(
  lineGroupOrderParticipantId: string | null,
  hostParticipantId: string
): string {
  return lineGroupOrderParticipantId ?? hostParticipantId;
}

export function canEditGroupCartLine(args: {
  sessionLocked: boolean;
  viewerIsHost: boolean;
  viewerParticipantId: string | null;
  hostParticipantId: string;
  lineGroupOrderParticipantId: string | null;
}): boolean {
  if (args.sessionLocked) return false;
  if (args.viewerIsHost) return true;
  if (!args.viewerParticipantId) return false;
  const owner = effectiveLineParticipantId(args.lineGroupOrderParticipantId, args.hostParticipantId);
  return owner === args.viewerParticipantId;
}

export function buildGroupOrderCartReadModel(
  lines: GroupOrderCartLineInput[],
  participants: GroupOrderParticipantInput[],
  options?: { tipPreviewPercent?: number }
): GroupOrderCartReadModel | null {
  const host = participants.find((p) => p.isHost);
  if (!host) return null;

  const percent = options?.tipPreviewPercent ?? GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT;
  const ordered = [...participants].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const subById = new Map<string, number>();
  for (const p of ordered) {
    subById.set(p.id, 0);
  }

  let groupFood = 0;
  for (const line of lines) {
    const lineCents = line.priceCents * line.quantity;
    groupFood += lineCents;
    const pid = effectiveLineParticipantId(line.groupOrderParticipantId, host.id);
    subById.set(pid, (subById.get(pid) ?? 0) + lineCents);
  }

  const weights = ordered.map((p) => subById.get(p.id) ?? 0);
  const illustrativeTotalTip = tipCentsForPercentPreview(groupFood, percent);
  const tipShares = splitProRata(illustrativeTotalTip, weights);

  const participantRows: GroupOrderParticipantRow[] = ordered.map((p, i) => ({
    participantId: p.id,
    displayName: p.displayName,
    isHost: p.isHost,
    subtotalCents: weights[i] ?? 0,
    illustrativeTipShareCents: tipShares[i] ?? 0,
  }));

  return {
    groupFoodSubtotalCents: groupFood,
    illustrativeTotalTipCents: illustrativeTotalTip,
    participantRows,
    hostParticipantId: host.id,
  };
}

export function findParticipantRow(
  model: GroupOrderCartReadModel,
  participantId: string
): GroupOrderParticipantRow | undefined {
  return model.participantRows.find((r) => r.participantId === participantId);
}
