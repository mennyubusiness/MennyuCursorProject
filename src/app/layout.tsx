import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import "./globals.css";
import Link from "next/link";
import { auth } from "@/auth";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";
import { resolveHeaderNavContext } from "@/lib/auth/header-nav-context";
import { getActiveOrderByCustomerPhone } from "@/services/order.service";

export const metadata: Metadata = {
  title: "Mennyu – Multi-vendor food cart ordering",
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
  const session = await auth();
  const customerPhone = await resolveCustomerPhoneForSession(headersList, session?.user?.id ?? null);
  const hasServerSession = Boolean(session?.user);
  const headerNav = await resolveHeaderNavContext(session?.user?.id ?? null, customerPhone);
  const activeOrder =
    !isAdmin && customerPhone ? await getActiveOrderCached(customerPhone) : null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <AuthSessionProvider session={session}>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link
              href="/"
              className="text-xl font-semibold text-black transition-colors duration-200 hover:text-mennyu-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary"
            >
              Mennyu
            </Link>
            <SiteHeaderNav
              callbackPath={pathname || "/"}
              customerPhone={customerPhone}
              hasServerSession={hasServerSession}
              navMode={headerNav.mode}
              dashboardHref={headerNav.dashboardHref}
              accountLabel={headerNav.accountLabel}
              activeOrderHref={
                activeOrder ? `/order/${activeOrder.id}` : null
              }
              cartHref="/cart"
            />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
          © Mennyu · mennyu.com
        </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
