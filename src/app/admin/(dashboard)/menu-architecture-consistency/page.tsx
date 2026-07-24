import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { buildMenuArchitectureConsistencyReport } from "@/lib/admin-menu-architecture-consistency.server";
import { env } from "@/lib/env";

export default async function AdminMenuArchitectureConsistencyPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed && env.NODE_ENV === "production") {
    redirect("/admin/access-denied");
  }

  const { vendorId } = await searchParams;
  const report = await buildMenuArchitectureConsistencyReport({
    vendorId: vendorId?.trim() || null,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link href="/admin" className="text-sm text-stone-500 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">Menu architecture consistency</h1>
        <p className="mt-1 text-sm text-stone-600">
          Phase 2 diagnostics only. No tokens or connection secrets are shown.
          {report.vendorId ? (
            <>
              {" "}
              Scoped to vendor <span className="font-mono text-xs">{report.vendorId}</span>.
            </>
          ) : (
            " Scanning recent jobs across active vendors."
          )}
        </p>
        <p className="mt-1 text-xs text-stone-500">Generated {report.generatedAt}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded border border-red-200 bg-red-50 px-3 py-1 text-red-900">
          Errors: {report.summary.errors}
        </span>
        <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
          Warnings: {report.summary.warnings}
        </span>
        <span className="rounded border border-stone-200 bg-stone-50 px-3 py-1 text-stone-800">
          Info: {report.summary.infos}
        </span>
      </div>

      <ul className="space-y-2">
        {report.findings.map((f, i) => (
          <li
            key={`${f.code}-${f.entityId ?? i}`}
            className={`rounded-lg border px-3 py-2 text-sm ${
              f.severity === "error"
                ? "border-red-200 bg-red-50 text-red-950"
                : f.severity === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-stone-200 bg-white text-stone-800"
            }`}
          >
            <div className="font-mono text-xs opacity-70">{f.code}</div>
            <div className="mt-0.5">{f.message}</div>
            {(f.vendorName || f.vendorId) && (
              <div className="mt-1 text-xs opacity-70">
                {f.vendorName ?? f.vendorId}
                {f.entityId ? ` · ${f.entityId}` : ""}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-stone-500">
        JSON:{" "}
        <Link
          className="underline"
          href={`/api/admin/menu-architecture-consistency${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ""}`}
        >
          /api/admin/menu-architecture-consistency
        </Link>
      </p>
    </div>
  );
}
