"use client";

/**
 * Shared note when admin API URLs omit `?admin=` (build-time secret).
 * Platform admin session cookies also authorize — this is a fallback hint only.
 */
export function AdminApiAuthHint({
  show,
  compact = false,
  className = "",
}: {
  show: boolean;
  /** One line for tight layouts (e.g. modals). */
  compact?: boolean;
  className?: string;
}) {
  if (!show) return null;
  if (compact) {
    return (
      <p className={`text-xs text-amber-800 ${className}`}>
        If this returns 403: sign in as a Mennyu platform admin, or configure{" "}
        <code className="rounded bg-amber-100 px-0.5">ADMIN_SECRET</code> /{" "}
        <code className="rounded bg-amber-100 px-0.5">NEXT_PUBLIC_ADMIN_SECRET</code> for{" "}
        <code className="rounded bg-amber-100 px-0.5">?admin=</code>.
      </p>
    );
  }
  return (
    <p className={`text-xs text-amber-800 ${className}`}>
      <strong>Production:</strong> If requests return 403, sign in with a Mennyu platform admin account in this browser,
      or ensure the server passes <code className="rounded bg-amber-100 px-0.5">ADMIN_SECRET</code> to this UI (or set{" "}
      <code className="rounded bg-amber-100 px-0.5">NEXT_PUBLIC_ADMIN_SECRET</code> at build) so calls can include{" "}
      <code className="rounded bg-amber-100 px-0.5">?admin=</code>.
    </p>
  );
}
