import Link from "next/link";

/** Server-rendered guidance for the primary (magic link) access path. */
export function VendorDashboardAccessCard({
  vendorId,
  hasDashboardSecret,
}: {
  vendorId: string;
  hasDashboardSecret: boolean;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Secure dashboard access</h3>
      <p className="mt-2 text-sm text-stone-600">
        Sign in with your <strong>email and password</strong> at{" "}
        <Link href="/login" className="font-medium text-sky-800 underline">
          /login
        </Link>
        , then open this vendor dashboard. Your admin creates the account and links it to your vendor. Alternatively,
        a <strong>secure access link</strong> or legacy token can still bootstrap the old cookie for automation.
      </p>
      {!hasDashboardSecret ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Access isn&apos;t provisioned yet. Ask your admin to create a secure link (recommended) or run the
          dashboard token API — then reload this page.
        </p>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          Already have a link? Open it on this device. You can also use{" "}
          <Link href={`/vendor/${vendorId}/menu-imports`} className="font-medium text-sky-800 underline">
            Menu imports
          </Link>{" "}
          after signing in.
        </p>
      )}
    </section>
  );
}
