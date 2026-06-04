import {
  ADMIN_SECTION_CARD,
  formatAdminOrderDate,
} from "@/lib/admin-order-detail-ui";
import {
  formatAdminGroupOrderStatus,
  type AdminOrderGroupContext,
} from "@/lib/admin-order-group-context";

export function AdminOrderGroupOrderPanel({ context }: { context: AdminOrderGroupContext }) {
  return (
    <section className={ADMIN_SECTION_CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-oo-charcoal">Group order</h2>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-950 ring-1 ring-sky-200/80">
          Group order
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-oo-stone-gray">
        Host paid for this group order. Participant names are shown for support and refund context.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-oo-stone-gray">Host</dt>
          <dd className="mt-0.5 text-oo-charcoal">
            <span className="font-medium">{context.hostDisplayName}</span>
            {context.hostUserEmail ? (
              <span className="block text-xs text-oo-stone-gray">{context.hostUserEmail}</span>
            ) : context.hostUserName ? (
              <span className="block text-xs text-oo-stone-gray">{context.hostUserName}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-oo-stone-gray">Group code</dt>
          <dd className="mt-0.5 font-mono font-semibold tracking-wider text-oo-charcoal">
            {context.joinCode}
          </dd>
        </div>
        <div>
          <dt className="text-oo-stone-gray">Participants</dt>
          <dd className="mt-0.5 text-oo-charcoal">
            {context.activeParticipantCount} active
            {context.participantCount !== context.activeParticipantCount
              ? ` · ${context.participantCount} total`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-oo-stone-gray">Group status</dt>
          <dd className="mt-0.5 text-oo-charcoal">{formatAdminGroupOrderStatus(context.status)}</dd>
        </div>
        {context.lockedAt ? (
          <div>
            <dt className="text-oo-stone-gray">Checkout locked at</dt>
            <dd className="mt-0.5 text-oo-charcoal">{formatAdminOrderDate(context.lockedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-oo-stone-gray">Session expires</dt>
          <dd className="mt-0.5 text-oo-charcoal">{formatAdminOrderDate(context.expiresAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-oo-light-stone pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Participants
        </h3>
        <ul className="mt-2 space-y-2">
          {context.participants.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-oo-light-stone/90 bg-oo-cream/30 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-oo-charcoal">{p.displayName}</span>
                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-oo-stone-gray ring-1 ring-oo-light-stone">
                  {p.role === "host" ? "Host" : "Participant"}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-oo-stone-gray">
                {p.phoneMasked ? <p>Phone: {p.phoneMasked}</p> : null}
                {p.userEmail ? <p>Signed in: {p.userEmail}</p> : null}
                {p.leftAt ? (
                  <p className="text-amber-900">Left before checkout: {formatAdminOrderDate(p.leftAt)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
