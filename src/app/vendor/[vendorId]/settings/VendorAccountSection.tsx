/**
 * Minimal account context for signed-in vendor users (VendorMembership).
 * No sign-in prompts, tokens, or temporary-access copy — those belong in admin tools only.
 */
export function VendorAccountSection({
  email,
  variant = "vendor",
}: {
  email: string | null;
  variant?: "vendor" | "admin";
}) {
  const display = email?.trim() || null;

  if (variant === "admin") {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h4 className="text-base font-semibold text-stone-900">Session</h4>
        <p className="mt-2 text-sm text-stone-600">
          Signed in as{" "}
          <span className="font-medium text-stone-900">{display ?? "your administrator account"}</span>.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          You are viewing this restaurant with Mennyu platform administrator access.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-stone-900">Your account</h4>
      <p className="mt-2 text-sm text-stone-600">
        Signed in as{" "}
        <span className="font-medium text-stone-900">{display ?? "your team account"}</span>.
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Access to this dashboard is linked to your Mennyu account and restaurant membership.
      </p>
    </div>
  );
}
