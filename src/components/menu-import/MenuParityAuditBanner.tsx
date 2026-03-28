/** Mirrors `MenuParityAuditResult` without importing server-only modules into the client graph. */
export type MenuParityAuditBannerProps = {
  audit: {
    ok: boolean;
    skippedReason?: "no_published_version";
    issues: Array<{ code: string; message: string; refs?: string[] }>;
  };
};

/**
 * Shown on menu import job pages when live DB rows drift from the published canonical snapshot.
 */
export function MenuParityAuditBanner({ audit }: MenuParityAuditBannerProps) {
  if (audit.skippedReason === "no_published_version") return null;
  if (audit.ok) return null;

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">Menu parity warning</p>
      <p className="mt-1 text-amber-900">
        Live menu rows may not match the published canonical snapshot ({audit.issues.length}{" "}
        issue{audit.issues.length === 1 ? "" : "s"}). Snooze and Deliverect mapping can misbehave
        until resolved—try republishing from a clean import.
      </p>
      <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs">
        {audit.issues.slice(0, 12).map((i, idx) => (
          <li key={idx}>
            <span className="font-mono">{i.code}</span>
            {i.refs?.length ? ` — ${i.refs.join(", ")}` : ""}: {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
