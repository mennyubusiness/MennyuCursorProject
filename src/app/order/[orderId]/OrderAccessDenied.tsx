import Link from "next/link";

import { ORDERS_SIGN_IN_PATH } from "@/lib/auth/account-paths";
import { buttonClassName } from "@/components/ui/button";

export function OrderAccessDenied({
  status,
  message,
}: {
  status: 401 | 403 | 404;
  message: string;
}) {
  if (status === 404) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-900">Order not found</h1>
        <p className="mt-3 text-stone-600">{message}</p>
        <Link
          href="/explore"
          className="mt-6 inline-block text-sm font-medium text-stone-900 hover:underline"
        >
          Back to explore
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">We couldn&apos;t verify access to this order</h1>
      <p className="mt-3 text-stone-600">
        Use the link from your order confirmation text, or sign in to view orders attached to your
        account.
      </p>
      {status === 403 && message && (
        <p className="mt-2 text-sm text-stone-500">{message}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href={ORDERS_SIGN_IN_PATH}
          className={buttonClassName({ variant: "primary", size: "sm" })}
        >
          Sign in
        </Link>
        <Link href="/explore" className="text-sm font-medium text-stone-700 hover:underline">
          Back to explore
        </Link>
      </div>
    </div>
  );
}
