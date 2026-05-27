"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function AdminAccessDeniedPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
        redirect: "follow",
      });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Access denied");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <AuthFormCard>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-oo-charcoal">Admin access</h1>
          <p className="mt-2 text-sm text-oo-stone-gray">
            Enter the admin secret to continue. In development, access is automatic.
          </p>
          <p className="mt-3 text-sm text-oo-stone-gray">
            Platform admin?{" "}
            <Link
              href={`/login?callbackUrl=${encodeURIComponent("/admin")}`}
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              Sign in with email
            </Link>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-secret" className="oo-label">
              Admin secret
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
              className="oo-input"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verifying…" : "Continue"}
          </Button>
        </form>
        {error && (
          <p className="oo-form-error" role="alert">
            {error}
          </p>
        )}
      </AuthFormCard>
    </div>
  );
}
