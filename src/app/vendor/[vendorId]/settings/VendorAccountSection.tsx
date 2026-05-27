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
      <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h4 className="text-base font-semibold text-oo-charcoal">Session</h4>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Signed in as{" "}
          <span className="font-medium text-oo-charcoal">{display ?? "your administrator account"}</span>.
        </p>
        <p className="mt-2 text-sm text-oo-stone-gray">
          You are viewing this restaurant with Open Order platform administrator access.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-oo-charcoal">Your account</h4>
      <p className="mt-2 text-sm text-oo-stone-gray">
        Signed in as{" "}
        <span className="font-medium text-oo-charcoal">{display ?? "your team account"}</span>.
      </p>
      <p className="mt-2 text-sm text-oo-stone-gray">
        Access to this dashboard is linked to your Open Order account and restaurant membership.
      </p>
    </div>
  );
}
