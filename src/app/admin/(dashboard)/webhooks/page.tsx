import Link from "next/link";
import {
  getAdminWebhookHealthSummary,
  searchAdminWebhookEvents,
} from "@/services/admin-webhook-health.service";

function filterLink(label: string, href: string, active: boolean) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          : "rounded border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm text-oo-charcoal hover:bg-oo-cream"
      }
    >
      {label}
    </Link>
  );
}

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const provider = typeof params.provider === "string" ? params.provider : "all";
  const status = typeof params.status === "string" ? params.status : "all";
  const pageRaw = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

  const [summary, { rows, total, page, pageSize }] = await Promise.all([
    getAdminWebhookHealthSummary(),
    searchAdminWebhookEvents({
      provider: provider as "stripe" | "deliverect" | "twilio" | "all",
      status: status as "processed" | "failed" | "all",
      page: Number.isFinite(pageRaw) ? pageRaw : 1,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Webhooks</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Integration health from persisted WebhookEvent rows. Payload secrets are not displayed.{" "}
          <Link href="/admin/deliverect-webhook-incidents" className="underline">
            POS sync incidents
          </Link>{" "}
          has Deliverect-specific triage.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-2xl font-semibold">{summary.stripeFailed24h}</p>
          <p className="text-sm text-oo-stone-gray">Stripe failures (24h)</p>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-2xl font-semibold">{summary.deliverectFailed24h}</p>
          <p className="text-sm text-oo-stone-gray">Deliverect failures (24h)</p>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-sm font-medium text-oo-charcoal">
            {summary.stripeLastSuccessAt?.toLocaleString() ?? "Not logged"}
          </p>
          <p className="text-sm text-oo-stone-gray">Last Stripe success</p>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-sm font-medium text-oo-charcoal">
            {summary.deliverectLastSuccessAt?.toLocaleString() ?? "Not logged"}
          </p>
          <p className="text-sm text-oo-stone-gray">Last Deliverect success</p>
        </div>
      </div>

      {!summary.replayConfigured && (
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/50 px-4 py-3 text-sm text-oo-stone-gray">
          Webhook replay: disabled — safe replay infrastructure is not configured in admin.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filterLink("All providers", "/admin/webhooks", provider === "all")}
        {filterLink("Stripe", "/admin/webhooks?provider=stripe", provider === "stripe")}
        {filterLink("Deliverect", "/admin/webhooks?provider=deliverect", provider === "deliverect")}
        {filterLink("Failed", "/admin/webhooks?status=failed", status === "failed")}
      </div>

      <div className="overflow-x-auto rounded-lg border border-oo-light-stone">
        <table className="min-w-full divide-y divide-oo-light-stone text-sm">
          <thead className="bg-oo-cream/80 text-left text-xs uppercase tracking-wide text-oo-stone-gray">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Related</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-oo-light-stone bg-oo-warm-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-oo-stone-gray">
                  {summary.webhookLoggingConfigured
                    ? "No webhook events match filters."
                    : "Webhook event logging is not configured yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.eventType ?? row.externalEventId ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.relatedEntityType && row.relatedEntityId
                      ? `${row.relatedEntityType}:${row.relatedEntityId.slice(-8)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-oo-stone-gray max-w-xs truncate">
                    {row.errorMessage ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.adminHref ? (
                      <Link href={row.adminHref} className="text-brand underline">
                        Open
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-oo-stone-gray">
        {total} event(s) · page {page} of {totalPages}
      </p>
    </div>
  );
}
