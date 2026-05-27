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
    pathname === "/login" ||
    pathname === "/register" ||
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

  return (
    <html lang="en">
      <body
        className={cn(
          "flex min-h-screen flex-col antialiased",
          isAdmin ? "bg-zinc-100 text-zinc-950" : "bg-zinc-50 text-zinc-950"
        )}
      >
        <AuthSessionProvider session={session}>
          <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-black/95 backdrop-blur-md">
            <PageShell className="flex h-16 items-center justify-between gap-4 sm:h-[4.25rem]">
              <OpenOrderLogo variant="header" priority />
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
