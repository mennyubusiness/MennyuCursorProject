import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { PageShell } from "@/components/layout/page-shell";

/** Admin nav; gate is applied in (dashboard)/layout so access-denied page can render. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="border-b border-zinc-200 bg-white">
        <PageShell className="py-3">
          <AdminTopNav />
        </PageShell>
      </div>
      <div className="oo-shell py-10 lg:py-12">{children}</div>
    </div>
  );
}
