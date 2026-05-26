import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import "./globals.css";
import Link from "next/link";
import { auth } from "@/auth";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { SiteFooter } from "@/components/layout/site-footer";
import { PageShell } from "@/components/layout/page-shell";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";
import { resolveHeaderNavContext } from "@/lib/auth/header-nav-context";
import { getActiveOrderByCustomerPhone } from "@/services/order.service";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Open Order – Multi-vendor food cart ordering",
  description: "Order from multiple food cart vendors in one place. One cart, one payment.",
};

const getActiveOrderCached = cache(getActiveOrderByCustomerPhone);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const isFullBleed =
    pathname === "/" ||
    pathname === "/explore" ||
    pathname === "/login" ||
    pathname === "/register";
  const hideFooter = pathname === "/login" || pathname === "/register";
  const session = await auth();
  const customerPhone = await resolveCustomerPhoneForSession(headersList, session?.user?.id ?? null);
  const hasServerSession = Boolean(session?.user);
  const headerNav = await resolveHeaderNavContext(session?.user?.id ?? null, customerPhone);
  const activeOrder =
    !isAdmin && customerPhone ? await getActiveOrderCached(customerPhone) : null;

  if (isAdmin) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-zinc-100 text-zinc-950 antialiased">
          <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 antialiased">
        <AuthSessionProvider session={session}>
          <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-black/95 backdrop-blur-md">
            <PageShell className="flex h-16 items-center justify-between gap-4 sm:h-[4.25rem]">
              <Link
                href="/"
                className="group flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-black text-white shadow-[0_0_20px_rgba(212,16,16,0.35)] transition group-hover:shadow-[0_0_24px_rgba(212,16,16,0.5)]"
                  aria-hidden
                >
                  O
                </span>
                <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Open Order
                </span>
              </Link>
              <SiteHeaderNav
                callbackPath={pathname || "/"}
                customerPhone={customerPhone}
                hasServerSession={hasServerSession}
                navMode={headerNav.mode}
                dashboardHref={headerNav.dashboardHref}
                accountLabel={headerNav.accountLabel}
                activeOrderHref={activeOrder ? `/order/${activeOrder.id}` : null}
                cartHref="/cart"
              />
            </PageShell>
          </header>
          <main
            className={cn(
              "w-full flex-1",
              isFullBleed ? "" : "px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
            )}
          >
            {children}
          </main>
          {!hideFooter && <SiteFooter />}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
