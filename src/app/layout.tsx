import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import "./globals.css";
import { auth } from "@/auth";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { SiteFooter } from "@/components/layout/site-footer";
import { PageShell } from "@/components/layout/page-shell";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";
import { resolveHeaderNavContext } from "@/lib/auth/header-nav-context";
import { getActiveOrderByCustomerPhone } from "@/services/order.service";
import { cn } from "@/lib/cn";
import { OpenOrderLogo } from "@/components/brand/OpenOrderLogo";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { CustomerQuickCartShell } from "@/components/cart/CustomerQuickCartShell";
import { isQuickCartEnabledForPath } from "@/lib/quick-cart-enabled";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOriginFromEnv()),
  title: "Open Order – Multi-vendor food cart ordering",
  description: "Order from multiple food cart vendors in one place. One cart, one payment.",
  openGraph: {
    title: "Open Order Co.",
    description: "Order everywhere. Pay once. Multi-vendor food pods, one cart, one pickup.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Order Co.",
    description: "Order everywhere. Pay once.",
  },
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
  const isPodMarketplace = /^\/pod\/[^/]+$/.test(pathname);
  const isVendorMenuPage = /^\/pod\/[^/]+\/vendor\/[^/]+$/.test(pathname);
  const isFullBleed =
    pathname === "/" ||
    pathname === "/explore" ||
    pathname === "/about" ||
    pathname === "/for-pods" ||
    pathname === "/faq" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    isPodMarketplace ||
    isVendorMenuPage;
  const hideFooter =
    pathname === "/login" || pathname === "/register" || isAdmin;
  const session = await auth();
  const customerPhone = await resolveCustomerPhoneForSession(headersList, session?.user?.id ?? null);
  const hasServerSession = Boolean(session?.user);
  const headerNav = await resolveHeaderNavContext(session?.user?.id ?? null, customerPhone);
  const activeOrder =
    !isAdmin && customerPhone ? await getActiveOrderCached(customerPhone) : null;
  const quickCartEnabled = isQuickCartEnabledForPath(pathname);

  return (
    <html lang="en">
      <body
        className={cn(
          "flex min-h-screen flex-col antialiased",
          isAdmin ? "bg-oo-cream text-oo-charcoal" : "bg-oo-cream text-oo-charcoal"
        )}
      >
        <AuthSessionProvider session={session} hasServerSession={hasServerSession}>
          <CustomerQuickCartShell enabled={quickCartEnabled} hasServerSession={hasServerSession}>
          <header className="sticky top-0 z-50 border-b border-oo-warm-white/20 bg-oo-charcoal/35 backdrop-blur-md">
            <PageShell className="flex h-16 items-center gap-3 sm:h-[4.25rem] sm:gap-4">
              <OpenOrderLogo variant="mark-with-label" priority />
              <SiteHeaderNav
                hasServerSession={hasServerSession}
                navMode={headerNav.mode}
                accountMenu={headerNav.accountMenu}
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
          </CustomerQuickCartShell>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
