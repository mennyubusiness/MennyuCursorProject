import Link from "next/link";

import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";

type AccountSecurityCardProps = {
  email: string;
};

export function AccountSecurityCard({ email }: AccountSecurityCardProps) {
  const forgotPasswordHref = `/forgot-password?email=${encodeURIComponent(email)}`;

  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Security</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>
        Manage how you sign in to Open Order with email and password.
      </p>
      <div className="mt-5 rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
        <p className="text-sm font-medium text-oo-charcoal">Password</p>
        <p className="mt-1 text-sm text-oo-stone-gray">
          To change your password, we&apos;ll email you a secure reset link.
        </p>
        <Link
          href={forgotPasswordHref}
          className="mt-3 inline-flex rounded-lg border border-oo-charcoal bg-oo-warm-white px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-white"
        >
          Change password
        </Link>
      </div>
    </section>
  );
}
