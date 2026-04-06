import Link from "next/link";

/** Admin nav; gate is applied in (dashboard)/layout so access-denied page can render. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/admin" className="font-medium text-stone-900 hover:text-stone-600">
              Overview
            </Link>
            <Link href="/admin/exceptions" className="text-stone-600 hover:text-stone-900">
              Needs attention
            </Link>
            <Link href="/admin/orders" className="text-stone-600 hover:text-stone-900">
              Orders
            </Link>
            <Link href="/admin/menu-imports" className="text-stone-600 hover:text-stone-900">
              Menu imports
            </Link>
            <Link href="/admin/analytics" className="text-stone-600 hover:text-stone-900">
              Analytics
            </Link>
            <span className="text-stone-400">|</span>
            <span className="text-xs uppercase tracking-wide text-stone-400">Marketplace</span>
            <Link href="/admin/vendors" className="text-stone-600 hover:text-stone-900">
              Vendors
            </Link>
            <Link
              href="/admin/deliverect-webhook-incidents"
              className="text-stone-600 hover:text-stone-900"
            >
              Deliverect webhooks
            </Link>
            <Link href="/admin/pods" className="text-stone-600 hover:text-stone-900">
              Pods
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
