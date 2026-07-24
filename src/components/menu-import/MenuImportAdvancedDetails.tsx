import type { MenuImportSource } from "@prisma/client";
import { jobSourceLocationId } from "@/domain/menu-import/canonical-identity";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export function MenuImportAdvancedDetails({
  jobId,
  status,
  source,
  errorCode,
  errorMessage,
  startedAt,
  completedAt,
  draftVersionId,
  deliverectChannelLinkId,
  deliverectLocationId,
  sourceLocationId = null,
  deliverectMenuId,
  snapshotJson,
  rawPayloadJson,
}: {
  jobId: string;
  status: string;
  source: MenuImportSource;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  draftVersionId: string | null;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  sourceLocationId?: string | null;
  deliverectMenuId: string | null;
  snapshotJson: unknown;
  rawPayloadJson: unknown;
}) {
  const location = jobSourceLocationId({ sourceLocationId, deliverectLocationId });

  return (
    <details className="rounded-lg border border-stone-200 bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-800">
        Advanced — import metadata &amp; debug
      </summary>
      <div className="space-y-4 border-t border-stone-100 p-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Job ID</dt>
            <dd className="font-mono text-xs text-stone-900">{jobId}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Internal status</dt>
            <dd className="font-mono text-xs text-stone-900">{status}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Source</dt>
            <dd className="font-mono text-xs text-stone-900">{source}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Draft version</dt>
            <dd className="font-mono text-xs text-stone-900">{draftVersionId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Started</dt>
            <dd className="text-stone-900">{formatDate(startedAt)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Completed</dt>
            <dd className="text-stone-900">{formatDate(completedAt)}</dd>
          </div>
          {deliverectChannelLinkId && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Deliverect</dt>
              <dd className="text-xs text-stone-700">
                channelLink <span className="font-mono">{deliverectChannelLinkId}</span>
                {deliverectMenuId && (
                  <>
                    {" "}
                    · menu <span className="font-mono">{deliverectMenuId}</span>
                  </>
                )}
              </dd>
            </div>
          )}
          {location.locationId && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">
                {source === "SQUARE_CATALOG_PULL"
                  ? "Square location"
                  : deliverectChannelLinkId
                    ? "Source location"
                    : "Source location"}
              </dt>
              <dd className="font-mono text-xs text-stone-700">
                {location.locationId}
                {location.usedLegacyFallback ? (
                  <span className="ml-2 text-amber-800">(via legacy deliverectLocationId)</span>
                ) : null}
              </dd>
            </div>
          )}
          {errorMessage && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Job error</dt>
              <dd className="text-red-800">{errorMessage}</dd>
            </div>
          )}
          {errorCode && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">errorCode</dt>
              <dd className="font-mono text-xs text-stone-800">{errorCode}</dd>
            </div>
          )}
        </dl>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Canonical snapshot (truncated)
          </h3>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-stone-50 p-2 text-[11px] text-stone-800">
            {JSON.stringify(snapshotJson, null, 2)?.slice(0, 8000) ?? "—"}
          </pre>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Raw payload (truncated)
          </h3>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-stone-50 p-2 text-[11px] text-stone-800">
            {JSON.stringify(rawPayloadJson, null, 2)?.slice(0, 8000) ?? "—"}
          </pre>
        </div>
      </div>
    </details>
  );
}
