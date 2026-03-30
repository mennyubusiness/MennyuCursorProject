import Link from "next/link";

export function VendorDashboardAccessCard({
  vendorId,
  hasDashboardSecret,
}: {
  vendorId: string;
  hasDashboardSecret: boolean;
}) {
  return (
    <div className="space-y-2 text-sm text-stone-600">
      <p>
        <Link
          href={`/login?intent=vendor&callbackUrl=${encodeURIComponent(`/vendor/${vendorId}`)}`}
          className="font-medium text-sky-800 underline"
        >
          Sign in
        </Link>{" "}
        with your Mennyu restaurant email and password.
      </p>
      <p className="text-xs text-stone-500">
        Admins can also send a one-time secure link. Extra options (token) are under{" "}
        <span className="text-stone-700">Advanced</span> below.
        {!hasDashboardSecret && " No token is set for this location yet."}
      </p>
    </div>
  );
}
