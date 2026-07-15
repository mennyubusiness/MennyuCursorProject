import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminPodDetail } from "@/services/admin-pod-detail.service";
import { AdminPodTechnicalDiagnostics } from "../AdminPodTechnicalDiagnostics";

export const dynamic = "force-dynamic";

export default async function AdminPodDiagnosticsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const id = podId?.trim();
  if (!id) notFound();

  const detail = await loadAdminPodDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/admin/pods/${id}`} className="hover:text-oo-charcoal hover:underline">
          {detail.pod.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">Technical diagnostics</span>
      </nav>

      <header className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h1 className="text-xl font-semibold text-oo-charcoal">Technical diagnostics</h1>
        <p className="mt-1 text-sm text-amber-950">
          Advanced troubleshooting view for engineers. Includes raw IDs, onboarding enums, slug
          redirects, and audit payloads. Use the{" "}
          <Link href={`/admin/pods/${id}`} className="font-semibold underline">
            pod overview
          </Link>{" "}
          for day-to-day management.
        </p>
      </header>

      <AdminPodTechnicalDiagnostics detail={detail} />
    </div>
  );
}
