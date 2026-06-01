import Link from "next/link";

type SmsConsentNoticeProps = {
  className?: string;
};

/**
 * Transactional SMS consent (TCPA / A2P) — not marketing opt-in.
 */
export function SmsConsentNotice({ className = "" }: SmsConsentNoticeProps) {
  return (
    <p className={`text-xs leading-relaxed text-oo-stone-gray ${className}`.trim()}>
      By entering my phone number, I agree to receive transactional text messages from Open Order
      for verification codes and pickup order updates. Message and data rates may apply. Reply STOP
      to opt out. See{" "}
      <Link href="/privacy" className="font-semibold text-brand hover:underline">
        Privacy Policy
      </Link>{" "}
      and{" "}
      <Link href="/terms" className="font-semibold text-brand hover:underline">
        Terms of Service
      </Link>
      .
    </p>
  );
}
