import Link from "next/link";
import { OpenOrderLogo } from "@/components/brand/OpenOrderLogo";
import { PageShell } from "@/components/layout/page-shell";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-black text-zinc-400">
      <PageShell className="flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-14">
        <div className="flex flex-col gap-4">
          <OpenOrderLogo variant="header" />
          <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
            Multi-vendor food cart ordering — one cart, one payment, one pickup.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium"
          aria-label="Footer"
        >
          <Link href="/explore" className="transition hover:text-white">
            Explore pods
          </Link>
          <Link href="/register" className="transition hover:text-white">
            List your pod
          </Link>
          <Link href="/login" className="transition hover:text-white">
            Sign in
          </Link>
        </nav>
        <p className="text-xs text-zinc-600 sm:text-right">
          © {new Date().getFullYear()} Open Order Co.
        </p>
      </PageShell>
    </footer>
  );
}
