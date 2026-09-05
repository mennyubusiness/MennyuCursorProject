"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { RegistrationIntent } from "@prisma/client";
import { registerWithEmailPassword } from "@/actions/register.actions";
import { setRegistrationRole, recordPendingVendorInviteFromReturnPath } from "@/actions/account-setup.actions";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";
import {
  appendNextQueryParam,
  isVendorInvitePath,
} from "@/lib/auth/invite-token-path";
import {
  buildLoginHrefWithReturn,
  readLoginReturnParam,
  sanitizeLoginReturnPath,
} from "@/lib/auth/login-return-path";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { isOwnershipClaimPath } from "@/lib/auth/ownership-claim-path";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPathRaw = readLoginReturnParam(searchParams);
  const returnPathSafe = sanitizeLoginReturnPath(returnPathRaw);
  const intentParam = searchParams.get("intent");
  const registrationIntent =
    intentParam === "vendor" ? "vendor" : intentParam === "pod_owner" ? "pod_owner" : null;
  const loginHref = returnPathSafe ? buildLoginHrefWithReturn(returnPathSafe) : "/login";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const name = String(fd.get("name") ?? "").trim();
    setLoading(true);
    try {
      const reg = await registerWithEmailPassword({
        email,
        password,
        name: name || undefined,
        verificationReturnPath:
          returnPathSafe && isOwnershipClaimPath(returnPathSafe) ? returnPathSafe : undefined,
      });
      if (!reg.ok) {
        setError(reg.error);
        return;
      }
      const sign = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account created but sign-in failed. Try signing in from the login page.");
        return;
      }

      if (returnPathSafe && isOwnershipClaimPath(returnPathSafe)) {
        router.push(returnPathSafe);
        router.refresh();
        return;
      }

      if (registrationIntent === "vendor") {
        const role = await setRegistrationRole(RegistrationIntent.vendor);
        if (!role.ok) {
          setError(role.error);
          return;
        }
        if (returnPathSafe && isVendorInvitePath(returnPathSafe)) {
          const persisted = await recordPendingVendorInviteFromReturnPath(returnPathSafe);
          if (!persisted.ok) {
            setError(persisted.error);
            return;
          }
        }
        const setupPath = role.nextPath ?? "/account/setup/vendor";
        router.push(
          returnPathSafe && isVendorInvitePath(returnPathSafe)
            ? appendNextQueryParam(setupPath, returnPathSafe)
            : setupPath
        );
        router.refresh();
        return;
      }

      if (registrationIntent === "pod_owner") {
        const role = await setRegistrationRole(RegistrationIntent.pod_owner);
        if (!role.ok) {
          setError(role.error);
          return;
        }
        router.push(role.nextPath ?? "/account/setup/pod");
        router.refresh();
        return;
      }

      if (returnPathSafe) {
        router.push(appendNextQueryParam(ACCOUNT_ROLE_PATH, returnPathSafe));
      } else {
        router.push(ACCOUNT_ROLE_PATH);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormCard>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          You&apos;ll choose whether you&apos;re ordering, running a restaurant, or managing a pod on
          the next step.
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <label htmlFor="register-name" className="oo-label">
            Name <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input id="register-name" name="name" autoComplete="name" className="oo-input" />
        </div>
        <div>
          <label htmlFor="register-email" className="oo-label">
            Email
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="oo-input"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="oo-label">
            Password
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="oo-input"
          />
          <p className="mt-1.5 text-xs text-zinc-500">Minimum 8 characters</p>
        </div>
        {error ? (
          <p className="oo-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Continue"}
        </Button>
      </form>
      <p className="border-t border-zinc-100 pt-4 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFormCard>
  );
}
