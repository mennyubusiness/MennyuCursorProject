"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { buildLoginHrefFromLocation } from "@/lib/auth/login-return-path";

function HeaderSignInLinkInner({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = buildLoginHrefFromLocation(pathname, searchParams);

  return (
    <Link href={href} className={className} title={title}>
      Sign in
    </Link>
  );
}

export function HeaderSignInLink(props: { className?: string; title?: string }) {
  return (
    <Suspense fallback={<HeaderSignInLinkFallback {...props} />}>
      <HeaderSignInLinkInner {...props} />
    </Suspense>
  );
}

function HeaderSignInLinkFallback({ className, title }: { className?: string; title?: string }) {
  return (
    <Link href="/login" className={className} title={title}>
      Sign in
    </Link>
  );
}
