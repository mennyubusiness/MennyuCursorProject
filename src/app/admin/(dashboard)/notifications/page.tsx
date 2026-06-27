import Link from "next/link";
import {
  searchAdminNotifications,
  SMS_EVENT_TYPE_HINTS,
  SMS_STATUS_FILTER_OPTIONS,
} from "@/services/admin-notification-search.service";
import { adminActionAvailability } from "@/services/admin-health-actions.service";

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

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const eventType = typeof params.eventType === "string" ? params.eventType : undefined;
  const orderId = typeof params.orderId === "string" ? params.orderId : undefined;
  const pageRaw = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

  const { rows, total, page, pageSize } = await searchAdminNotifications({
    status,
    eventType,
    orderId,
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
  });

  const actions = adminActionAvailability();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Notifications</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Transactional SMS log visibility. Phone numbers are masked; verification OTP content is never
          shown. Admins cannot bypass STOP/opt-out.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterLink("All", "/admin/notifications", !status)}
        {SMS_STATUS_FILTER_OPTIONS.slice(0, 6).map((s) =>
          filterLink(s, `/admin/notifications?status=${s}`, status === s)
        )}
      </div>

      {!actions.transactionalSmsResend && (
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/50 px-4 py-3 text-sm text-oo-stone-gray">
          Transactional SMS resend: disabled — {actions.transactionalSmsResend ? "" : "safe resend helper not wired in admin."}
          Receipt resend: disabled. Order status link resend: disabled.
        </div>
      )}

      <form className="flex flex-wrap gap-2" action="/admin/notifications" method="get">
        <input
          name="orderId"
          placeholder="Order ID"
          defaultValue={orderId}
          className="rounded border border-oo-light-stone px-3 py-1.5 text-sm"
        />
        <select
          name="eventType"
          defaultValue={eventType ?? ""}
          className="rounded border border-oo-light-stone px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {SMS_EVENT_TYPE_HINTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button
          type="submit"
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-oo-light-stone">
        <table className="min-w-full divide-y divide-oo-light-stone text-sm">
          <thead className="bg-oo-cream/80 text-left text-xs uppercase tracking-wide text-oo-stone-gray">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Suppression</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-oo-light-stone bg-oo-warm-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-oo-stone-gray">
                  No notification logs match filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.eventType}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.recipientMasked}</td>
                  <td className="px-3 py-2">
                    {row.orderId ? (
                      <Link href={`/admin/orders/${row.orderId}`} className="text-brand underline">
                        {row.orderId.slice(-8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-oo-stone-gray">
                    {[row.errorCode, row.failureMessage].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-oo-stone-gray">
                    {row.suppressionReason ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-oo-stone-gray">
        {total} log(s) · page {page} of {totalPages}
      </p>
    </div>
  );
}
