import Link from "next/link";
import { OpenOrderLogo } from "@/components/brand/OpenOrderLogo";
import { PageShell } from "@/components/layout/page-shell";

export function SiteFooter() {
  return (
    <footer className="border-t border-oo-light-stone/15 bg-oo-charcoal text-oo-stone-gray">
      <PageShell className="flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-14">
        <div className="flex flex-col gap-4">
          <OpenOrderLogo variant="header" />
          <p className="max-w-sm text-sm leading-relaxed text-oo-stone-gray">
            Multi-vendor food cart ordering — one cart, one payment, one pickup.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium"
          aria-label="Footer"
        >
          <Link href="/explore" className="transition hover:text-oo-warm-white">
            Explore pods
          </Link>
          <Link href="/register" className="transition hover:text-oo-warm-white">
            List your pod
          </Link>
          <Link href="/login" className="transition hover:text-oo-warm-white">
            Sign in
          </Link>
          <Link href="/privacy" className="transition hover:text-oo-warm-white">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-oo-warm-white">
            Terms
          </Link>
          <Link href="/sms-consent" className="transition hover:text-oo-warm-white">
            SMS consent
          </Link>
        </nav>
        <p className="text-xs text-oo-stone-gray/80 sm:text-right">
          © {new Date().getFullYear()} Open Order Co.
        </p>
      </PageShell>
    </footer>
  );
}
