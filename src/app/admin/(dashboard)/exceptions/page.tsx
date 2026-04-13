import { getAttentionItems } from "@/lib/admin-attention";
import { prisma } from "@/lib/db";
import { getAdminResolvedIssueHistory } from "@/services/issues.service";
import { IssuesWorkbench } from "./IssuesWorkbench";

export default async function AdminExceptionsPage() {
  const [activeItems, resolvedHistory, pods] = await Promise.all([
    getAttentionItems(),
    getAdminResolvedIssueHistory(200),
    prisma.pod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Issues</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        Active queue for routing, fulfillment, refunds, and tracked issues. Resolve on the order page for full controls;
        use filters to narrow the list.
      </p>

      <IssuesWorkbench initialActiveItems={activeItems} resolvedHistory={resolvedHistory} pods={pods} />
    </div>
  );
}
