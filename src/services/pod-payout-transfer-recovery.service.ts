import "server-only";

import { prisma } from "@/lib/db";
import {
  emptyReEvaluateSummary,
  isPodReEvaluateSkippedTerminal,
  POD_REEVALUATE_TRANSFER_STATUSES,
  type PayoutReEvaluateSummary,
} from "@/lib/payout-transfer-recovery";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";
import { recomputePodPayoutTransferRowFromContext } from "@/services/pod-payout-transfer.service";

export async function reEvaluateBlockedPodPayoutTransferRows(params?: {
  podId?: string;
  take?: number;
}): Promise<PayoutReEvaluateSummary> {
  const summary = emptyReEvaluateSummary();
  const rows = await prisma.podPayoutTransfer.findMany({
    where: {
      ...(params?.podId ? { podId: params.podId } : {}),
      status: { in: [...POD_REEVALUATE_TRANSFER_STATUSES] },
      OR: [{ stripeTransferId: null }, { stripeTransferId: "" }],
    },
    include: {
      pod: { select: { deletedAt: true } },
      podPayoutAllocation: {
        select: {
          podPayoutRecipientUser: { select: { deletedAt: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    ...(params?.take != null ? { take: params.take } : {}),
  });

  for (const row of rows) {
    summary.examined++;

    if (row.pod.deletedAt) {
      summary.skippedTerminal++;
      continue;
    }

    const recipient = row.podPayoutAllocation.podPayoutRecipientUser;
    if (recipient?.deletedAt) {
      summary.skippedTerminal++;
      continue;
    }

    if (isPodReEvaluateSkippedTerminal(row.status)) {
      summary.skippedTerminal++;
      continue;
    }

    const before = row.status;
    await recomputePodPayoutTransferRowFromContext(row.id);
    const after = await prisma.podPayoutTransfer.findUnique({
      where: { id: row.id },
      select: { status: true },
    });
    if (!after) continue;
    if (
      after.status === POD_PAYOUT_TRANSFER_STATUS.pending &&
      before !== POD_PAYOUT_TRANSFER_STATUS.pending
    ) {
      summary.promotedToPending++;
    } else if (after.status !== before) {
      summary.updatedBlocked++;
    } else {
      summary.unchanged++;
    }
  }

  return summary;
}
