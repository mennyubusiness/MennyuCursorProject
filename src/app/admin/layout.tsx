import { AdminModeBanner } from "@/components/admin/AdminModeBanner";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { PageShell } from "@/components/layout/page-shell";
import { shouldShowAdminModeBanner } from "@/lib/admin-mode-context";

/** Admin nav; gate is applied in (dashboard)/layout so access-denied page can render. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAdminBanner = await shouldShowAdminModeBanner("admin");

  return (
    <div className="oo-dash">
      {showAdminBanner ? <AdminModeBanner /> : null}
      <header className="oo-dash-titlebar">
        <PageShell className="overflow-visible py-3">
          <AdminTopNav />
        </PageShell>
      </header>
      <div className="oo-shell py-10 lg:py-12">{children}</div>
    </div>
  );
}
