import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import "./globals.css";
import Link from "next/link";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
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
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  const activeOrder =
    !isAdmin && customerPhone ? await getActiveOrderCached(customerPhone) : null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="text-xl font-semibold text-black hover:text-mennyu-primary">
              Mennyu
            </Link>
            <nav className="flex gap-6">
              <Link href="/explore" className="text-stone-600 hover:text-mennyu-primary">
                Explore pods
              </Link>
              <Link href="/orders" className="text-stone-600 hover:text-mennyu-primary">
                Order history
              </Link>
              <Link
                href={activeOrder ? `/order/${activeOrder.id}` : "/cart"}
                className="text-stone-600 hover:text-mennyu-primary"
              >
                Cart
              </Link>
              <Link href="/admin" className="text-stone-500 hover:text-mennyu-primary">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
          © Mennyu · mennyu.com
        </footer>
      </body>
    </html>
  );
}
