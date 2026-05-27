import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { PageShell } from "@/components/layout/page-shell";

/** Admin nav; gate is applied in (dashboard)/layout so access-denied page can render. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="oo-dash">
      <header className="oo-dash-titlebar">
        <PageShell className="py-3">
          <AdminTopNav />
        </PageShell>
      </header>
      <div className="oo-shell py-10 lg:py-12">{children}</div>
    </div>
  );
}
