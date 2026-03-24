import Link from "next/link";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

type AlertsMode = "admin" | "vendor";

/**
 * Replaces overlapping banners on admin; vendor mode only shows “not ready to publish”.
 */
export function MenuImportJobNextStepsAdmin({
  vendorName,
  isLatestActionableJob,
  newerActionableJob,
  publishBlocked,
  publishReasons,
  failedErrorCode,
  mode = "admin",
}: {
  vendorName: string;
  isLatestActionableJob: boolean;
  newerActionableJob: { id: string; startedAt: Date } | null;
  publishBlocked: boolean;
  publishReasons: string[];
  failedErrorCode: string | null;
  mode?: AlertsMode;
}) {
  const showAdminBanners = mode === "admin";

  return (
    <div className="space-y-4">
      {showAdminBanners && newerActionableJob && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">A newer menu update is waiting</p>
          <p className="mt-1 text-amber-900/90">
            Open the latest import for <strong>{vendorName}</strong> to review what customers will see.
          </p>
          <p className="mt-2">
            <Link
              href={`/admin/menu-imports/${newerActionableJob.id}#admin-menu-import-publish`}
              className="inline-flex rounded-md bg-amber-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-950"
            >
              Go to latest update
            </Link>
            <span className="ml-2 text-xs text-amber-800/90">
              {newerActionableJob.id.slice(0, 8)}… · {formatDate(newerActionableJob.startedAt)}
            </span>
          </p>
        </div>
      )}

      {showAdminBanners && isLatestActionableJob && (
        <div
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          <p className="font-medium">This is the latest menu update for {vendorName}</p>
          <p className="mt-1 text-emerald-900/90">
            Review the sections below, then use <strong>Publish to live menu</strong> in Actions when you&apos;re ready —
            or discard the draft if you need to start over.
          </p>
        </div>
      )}

      {publishBlocked && publishReasons.length > 0 && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Not ready to publish</p>
          <ul className="mt-2 list-inside list-disc text-amber-900/90">
            {publishReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {failedErrorCode && (
            <p className="mt-2 font-mono text-xs text-amber-800">errorCode: {failedErrorCode}</p>
          )}
        </div>
      )}
    </div>
  );
}
