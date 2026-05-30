import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadAccountPageContext } from "@/lib/account-page-context";
import {
  ACCOUNT_SIGN_IN_PATH,
  CUSTOMER_REGISTER_PATH,
  ORDER_HISTORY_PATH,
} from "@/lib/auth/account-paths";
import { AccountSessionActions } from "./AccountSessionActions";

const cardClass = "rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6";

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium capitalize text-stone-700">
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(ACCOUNT_SIGN_IN_PATH);
  }

  const ctx = await loadAccountPageContext(await headers());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">Account</h1>
        <p className="text-sm text-stone-600">
          Your sign-in, order history, and available tools.
        </p>
      </header>

      {ctx.emailAccount && (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-stone-900">Signed in</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd className="font-medium text-stone-900">{ctx.emailAccount.email}</dd>
            </div>
            {ctx.emailAccount.name && (
              <div>
                <dt className="text-stone-500">Name</dt>
                <dd className="font-medium text-stone-900">{ctx.emailAccount.name}</dd>
              </div>
            )}
            {ctx.checkoutPhone && (
              <div>
                <dt className="text-stone-500">Phone for order updates</dt>
                <dd className="font-medium text-stone-900">{ctx.checkoutPhone.phoneDisplay}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4">
            <Link href={ORDER_HISTORY_PATH} className="text-sm font-medium text-stone-900 hover:underline">
              View order history →
            </Link>
          </div>
        </section>
      )}

      {ctx.staff && (
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-stone-900">Staff, vendors, and admins</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-stone-500">Access</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {ctx.staff.isPlatformAdmin && <RoleBadge label="Platform admin" />}
                {ctx.staff.vendorMemberships.map((m) => (
                  <RoleBadge key={`vendor-${m.href}`} label={`Vendor · ${m.role}`} />
                ))}
                {ctx.staff.podMemberships.map((m) => (
                  <RoleBadge key={`pod-${m.href}`} label={`Pod · ${m.role}`} />
                ))}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-stone-900">Available tools</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href={ORDER_HISTORY_PATH} className="font-medium text-stone-900 hover:underline">
              Order history
            </Link>
            <span className="text-stone-500"> — past orders and reorder</span>
          </li>
          {ctx.staff?.vendorMemberships.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="font-medium text-stone-900 hover:underline">
                {m.vendorName}
              </Link>
              <span className="text-stone-500"> — vendor dashboard</span>
            </li>
          ))}
          {ctx.staff?.podMemberships.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="font-medium text-stone-900 hover:underline">
                {m.podName}
              </Link>
              <span className="text-stone-500"> — pod dashboard</span>
            </li>
          ))}
          {ctx.staff?.showAdminLink && (
            <li>
              <Link href="/admin" className="font-medium text-stone-900 hover:underline">
                Platform admin
              </Link>
              <span className="text-stone-500"> — operations and support tools</span>
            </li>
          )}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold text-stone-900">Sign out</h2>
        <div className="mt-4">
          <AccountSessionActions hasCheckoutPhoneSession={Boolean(ctx.checkoutPhone)} />
        </div>
        <p className="mt-4 text-sm text-stone-500">
          Need a customer account?{" "}
          <Link href={CUSTOMER_REGISTER_PATH} className="font-medium text-stone-900 hover:underline">
            Create account
          </Link>
        </p>
      </section>
    </div>
  );
}
