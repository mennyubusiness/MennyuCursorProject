import Link from "next/link";
import { AdminDeliverectTriageSection } from "@/components/admin/AdminDeliverectTriageSection";
import {
  fetchDeliverectWebhookIncidents,
  fetchDeliverectWebhookIncidentSummary,
  type DeliverectWebhookIncidentCategory,
  type DeliverectWebhookIncidentRow,
} from "@/services/deliverect-webhook-incidents.service";

function sinceFromRange(range: string | undefined): Date {
  const now = Date.now();
  switch (range) {
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "48h":
      return new Date(now - 48 * 60 * 60 * 1000);
    case "24h":
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}

const CATEGORY_OPTIONS: { value: DeliverectWebhookIncidentCategory | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "verification_failed", label: "Verification failed" },
  { value: "match_failed", label: "No matching VendorOrder" },
  { value: "apply_error", label: "Apply error" },
  { value: "unmapped_status", label: "Unmapped status" },
  { value: "ignored_backward", label: "Ignored backward" },
  { value: "noop_same_status", label: "No-op (same status)" },
  { value: "late_webhook", label: "Late / unusual apply" },
  { value: "applied_successfully", label: "Applied successfully" },
];

function rowTone(r: DeliverectWebhookIncidentRow): string {
  if (r.category === "verification_failed" || r.category === "match_failed" || r.category === "apply_error") {
    return "border-red-200 bg-red-50/50";
  }
  if (
    r.category === "unmapped_status" ||
    r.category === "ignored_backward" ||
    r.category === "late_webhook"
  ) {
    return "border-amber-200 bg-amber-50/40";
  }
  if (r.category === "applied_successfully" || r.category === "noop_same_status") {
    return "border-oo-light-stone bg-oo-cream/40 opacity-90";
  }
  return "border-oo-light-stone bg-oo-warm-white";
}

export default async function DeliverectWebhookIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; category?: string; routine?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "24h";
  const since = sinceFromRange(range);
  const category = (sp.category as DeliverectWebhookIncidentCategory | "all" | undefined) ?? "all";
  const includeRoutine = sp.routine === "1";
  const q = sp.q?.trim() ?? "";

  const [incidents, summary] = await Promise.all([
    fetchDeliverectWebhookIncidents({
      since,
      category: category === "all" ? "all" : category,
      includeRoutine,
      search: q || undefined,
      limit: 150,
    }),
    fetchDeliverectWebhookIncidentSummary(since),
  ]);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const r = patch.range ?? range;
    const c = patch.category ?? category;
    const rout = patch.routine ?? (includeRoutine ? "1" : "0");
    const qq = patch.q !== undefined ? patch.q : q;
    next.set("range", r);
    next.set("category", c);
    if (rout === "1") next.set("routine", "1");
    if (qq) next.set("q", qq);
    const s = next.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-oo-stone-gray">
          <Link href="/admin" className="hover:underline">
            Dashboard
          </Link>
          <span className="mx-1">/</span>
          <span className="text-oo-charcoal">POS sync</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold text-oo-charcoal">POS sync</h1>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Webhook pipeline, Deliverect reconciliation, and incident history. Technical detail: events come from{" "}
          <code className="rounded bg-oo-cream px-1 text-xs">WebhookEvent</code> and{" "}
          <code className="rounded bg-oo-cream px-1 text-xs">deliverectWebhookLastApply</code>; duplicate deliveries do
          not create a second row (<span className="font-mono text-xs">duplicate_ignored</span>).
        </p>
      </div>

      <AdminDeliverectTriageSection />

      <section
        className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm"
        aria-label="Snapshot summary"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Snapshot ({range})</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-oo-stone-gray">Verification failed</dt>
            <dd className="font-semibold text-oo-charcoal">{summary.verificationFailed}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Match failed</dt>
            <dd className="font-semibold text-oo-charcoal">{summary.matchFailed}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Apply errors</dt>
            <dd className="font-semibold text-oo-charcoal">{summary.applyErrors}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Unmapped status</dt>
            <dd className="font-semibold text-oo-charcoal">{summary.unmappedStatus}</dd>
          </div>
          <div>
            <dt className="text-oo-stone-gray">Late (after overdue)</dt>
            <dd className="font-semibold text-oo-charcoal">{summary.lateWebhook}</dd>
          </div>
        </dl>
      </section>

      <FilterBar range={range} category={category} includeRoutine={includeRoutine} q={q} buildHref={buildHref} />

      <ul className="space-y-2">
        {incidents.length === 0 ? (
          <li className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-8 text-center text-sm text-oo-stone-gray">
            No incidents in this window with current filters.
          </li>
        ) : (
          incidents.map((r) => (
            <li
              key={r.id}
              className={`rounded-lg border px-3 py-2.5 text-sm ${rowTone(r)}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-oo-charcoal">{r.label}</span>
                <time className="text-xs text-oo-stone-gray" dateTime={r.timestamp.toISOString()}>
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  }).format(r.timestamp)}
                </time>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-oo-charcoal">{r.summary}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-oo-stone-gray">
                <span>
                  <span className="text-oo-stone-gray">Source:</span> {r.source.replace(/_/g, " ")}
                </span>
                <span>
                  <span className="text-oo-stone-gray">Phase:</span> {r.phase.replace(/_/g, " ")}
                </span>
                {r.applySource ? (
                  <span>
                    <span className="text-oo-stone-gray">Apply source:</span> {r.applySource}
                  </span>
                ) : null}
                {r.vendorOrderId ? (
                  <span className="font-mono">
                    VO <span className="text-oo-charcoal">{r.vendorOrderId}</span>
                  </span>
                ) : null}
                {r.orderId ? (
                  <Link
                    href={`/admin/orders/${r.orderId}`}
                    className="font-medium text-sky-800 underline hover:text-sky-950"
                  >
                    Order {r.orderId.slice(0, 8)}…
                  </Link>
                ) : null}
                {r.vendorName ? (
                  <span>
                    <span className="text-oo-stone-gray">Vendor:</span> {r.vendorName}
                  </span>
                ) : null}
                {r.vendorId ? (
                  <Link
                    href={`/admin/vendors/${r.vendorId}/deliverect-mapping`}
                    className="text-sky-800 underline hover:text-sky-950"
                  >
                    Mapping
                  </Link>
                ) : null}
                {r.eventId ? (
                  <span className="max-w-[200px] truncate font-mono text-[10px]" title={r.eventId}>
                    event {r.eventId}
                  </span>
                ) : null}
                {r.idempotencyKey ? (
                  <span className="max-w-[180px] truncate font-mono text-[10px] text-oo-stone-gray" title={r.idempotencyKey}>
                    idem {r.idempotencyKey.slice(0, 36)}…
                  </span>
                ) : null}
              </div>
              {r.errorMessage ? (
                <p className="mt-1 font-mono text-[10px] text-red-900/90">{r.errorMessage}</p>
              ) : null}
              {(r.manualRecoveryContext || r.fallbackEpisodeContext || r.overdueReconciliationContext) && (
                <p className="mt-1 text-[11px] text-amber-900/90">
                  {r.manualRecoveryContext ? "· Manual recovery context " : ""}
                  {r.fallbackEpisodeContext ? "· Prior fallback episode " : ""}
                  {r.overdueReconciliationContext ? "· Overdue reconciliation window " : ""}
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function FilterBar({
  range,
  category,
  includeRoutine,
  q,
  buildHref,
}: {
  range: string;
  category: string;
  includeRoutine: boolean;
  q: string;
  buildHref: (patch: Record<string, string | undefined>) => string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
      <div>
        <span className="block text-xs font-medium text-oo-stone-gray">Quick range</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {(["24h", "48h", "7d"] as const).map((r) => (
            <Link
              key={r}
              href={buildHref({ range: r })}
              className={`rounded border px-2 py-1 text-xs ${
                range === r ? "border-brand bg-brand text-white" : "border-oo-light-stone bg-oo-cream text-oo-charcoal"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="cat" className="block text-xs font-medium text-oo-stone-gray">
          Incident type
        </label>
        <select
          id="cat"
          name="category"
          defaultValue={category}
          className="mt-1 block min-w-[200px] rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 pt-5">
        <input type="hidden" name="range" value={range} />
        <input type="checkbox" name="routine" value="1" id="routine" defaultChecked={includeRoutine} />
        <label htmlFor="routine" className="text-sm text-oo-charcoal">
          Include routine (success + no-op)
        </label>
      </div>
      <div>
        <label htmlFor="q" className="block text-xs font-medium text-oo-stone-gray">
          Search VO / order / event id
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="cuid fragment…"
          className="mt-1 block w-56 rounded border border-oo-light-stone px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-stone-200"
      >
        Apply
      </button>
      <Link href="/admin/deliverect-webhook-incidents" className="text-sm text-oo-stone-gray hover:underline">
        Reset
      </Link>
    </form>
  );
}
