import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { verifyEmailWithToken } from "@/services/email-verification.service";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim();

  if (!token) {
    return (
      <AuthShell>
        <VerifyEmailPanel
          title="Verification link missing"
          message="This verification link is invalid or expired."
          showResend
        />
      </AuthShell>
    );
  }

  const result = await verifyEmailWithToken(token);

  return (
    <AuthShell>
      <VerifyEmailPanel
        title={result.ok ? "Email verified" : "Verification failed"}
        message={result.message}
        success={result.ok}
        showResend={!result.ok}
      />
    </AuthShell>
  );
}

function VerifyEmailPanel({
  title,
  message,
  success,
  showResend,
}: {
  title: string;
  message: string;
  success?: boolean;
  showResend?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-oo-charcoal">{title}</h1>
      <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-oo-stone-gray"}`}>{message}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {showResend ? (
          <Link href="/account" className="font-semibold text-brand underline-offset-4 hover:underline">
            Request a new verification email
          </Link>
        ) : null}
        <Link href="/account" className="font-semibold text-brand underline-offset-4 hover:underline">
          Go to account
        </Link>
      </div>
    </div>
  );
}
