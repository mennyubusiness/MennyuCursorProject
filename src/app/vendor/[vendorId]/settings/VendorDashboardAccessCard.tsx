import Link from "next/link";

/** Primary path: email/password session. Magic link & token live under Advanced access. */
export function VendorDashboardAccessCard({
  vendorId,
  hasDashboardSecret,
}: {
  vendorId: string;
  hasDashboardSecret: boolean;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Sign-in &amp; access</h3>
      <p className="mt-2 text-sm text-stone-600">
        <strong>Sign in</strong> with the email and password your team uses for Mennyu:{" "}
        <Link href={`/login?intent=vendor&callbackUrl=${encodeURIComponent(`/vendor/${vendorId}`)}`} className="font-medium text-sky-800 underline">
          Sign in to this restaurant
        </Link>
        . After you&apos;re signed in, you can use orders, your current menu, and settings here.
      </p>
      <p className="mt-3 text-sm text-stone-600">
        Your administrator can also send a <strong>one-time secure link</strong> that opens this vendor area on your
        device—handy if you haven&apos;t set a password yet.
      </p>
      {!hasDashboardSecret ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Extra access options (token, automation) aren&apos;t set up for this location yet. You can still use email
          sign-in if your account is linked. Open <strong>Advanced access</strong> below for details.
        </p>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          After you&apos;re signed in, open{" "}
          <Link href={`/vendor/${vendorId}/menu`} className="font-medium text-sky-800 underline">
            Menu
          </Link>{" "}
          for your live items, or use <strong>View import history</strong> on that page when you need imports.
        </p>
      )}
    </section>
  );
}
