import type { ReactNode } from "react";
import Link from "next/link";

export type AdminDetailStatusTone = "success" | "warning" | "danger" | "neutral";

export function AdminStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: AdminDetailStatusTone;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-oo-light-stone bg-oo-cream text-oo-charcoal";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

export function AdminStatusCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">{title}</h3>
        {action}
      </div>
      <div className="mt-2 space-y-1 text-sm text-oo-charcoal">{children}</div>
    </div>
  );
}

export type AdminAttentionItem = {
  id: string;
  title: string;
  consequence: string;
  actionLabel: string;
  actionHref?: string;
  actionKind?: "link" | "anchor";
  tone: AdminDetailStatusTone;
  onActionClick?: () => void;
};

export function AdminAttentionSection({ items }: { items: AdminAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-oo-charcoal">Attention required</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border p-4 ${
              item.tone === "danger" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="text-sm font-semibold text-oo-charcoal">{item.title}</p>
            <p className="mt-1 text-sm text-oo-stone-gray">{item.consequence}</p>
            {item.actionHref ? (
              item.actionKind === "anchor" ? (
                <a
                  href={item.actionHref}
                  className="mt-3 inline-flex rounded-lg bg-oo-charcoal px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={item.onActionClick}
                >
                  {item.actionLabel}
                </a>
              ) : (
                <Link
                  href={item.actionHref}
                  className="mt-3 inline-flex rounded-lg bg-oo-charcoal px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {item.actionLabel}
                </Link>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminQuickActionButton({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className =
    "rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
