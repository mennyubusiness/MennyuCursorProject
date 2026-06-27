import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AdminAuditActionType, AdminAuditTargetType } from "@/lib/admin-audit-log";
import { serializeAuditValue } from "@/lib/admin-audit-log";

export type CreateAdminAuditLogInput = {
  adminUserId: string | null;
  actionType: AdminAuditActionType;
  targetType: AdminAuditTargetType;
  targetId: string;
  reason?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
};

export async function createAdminAuditLog(input: CreateAdminAuditLogInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      oldValue: serializeAuditValue(input.oldValue),
      newValue: serializeAuditValue(input.newValue),
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listAdminAuditLogsForUser(userId: string, limit = 25) {
  return prisma.adminAuditLog.findMany({
    where: {
      OR: [{ targetType: "user", targetId: userId }, { adminUserId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      adminUser: { select: { id: true, email: true, name: true } },
    },
  });
}
