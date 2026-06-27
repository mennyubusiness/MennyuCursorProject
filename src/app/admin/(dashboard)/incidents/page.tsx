import Link from "next/link";
import {
  searchAdminIncidents,
} from "@/services/admin-incident-detection.service";
import type { AdminIncidentSeverity, AdminIncidentType } from "@/lib/admin-incident-types";
import { AdminIncidentsClient } from "./AdminIncidentsClient";

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const severityRaw = typeof params.severity === "string" ? params.severity : "all";
  const typeRaw = typeof params.type === "string" ? params.type : "all";
  const pageRaw = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

  const severity: AdminIncidentSeverity | "all" =
    severityRaw === "critical" || severityRaw === "warning" || severityRaw === "info"
      ? severityRaw
      : "all";
  const type: AdminIncidentType | "all" =
    typeRaw === "stuck_order" ||
    typeRaw === "routing_failed" ||
    typeRaw === "payment" ||
    typeRaw === "order_status_mismatch" ||
    typeRaw === "pod_no_vendors" ||
    typeRaw === "vendor_no_items" ||
    typeRaw === "sms_failed" ||
    typeRaw === "webhook_failed" ||
    typeRaw === "open_issue"
      ? typeRaw
      : "all";

  const { rows, total, page, pageSize } = await searchAdminIncidents({
    severity,
    type,
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Incidents</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Operational problems detected from orders, payments, notifications, webhooks, and marketplace
          state. Derived read-only — resolve on linked admin detail pages. Also see{" "}
          <Link href="/admin/exceptions" className="underline">
            Issues
          </Link>{" "}
          for the full recovery workbench.
        </p>
      </div>

      <AdminIncidentsClient rows={rows} total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
