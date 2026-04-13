import { AdminTopNav } from "@/components/admin/AdminTopNav";

/** Admin nav; gate is applied in (dashboard)/layout so access-denied page can render. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <AdminTopNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
