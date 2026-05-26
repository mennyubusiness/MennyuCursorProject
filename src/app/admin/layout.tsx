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
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black">
        <PageShell className="py-4">
          <AdminTopNav />
        </PageShell>
      </header>
      <main className="oo-shell py-10 lg:py-12">{children}</main>
    </div>
  );
}
