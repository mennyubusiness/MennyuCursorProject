import Link from "next/link";

export function GroupOrderHostEmptyCartState({
  podId,
  podName,
  onInviteClickId,
}: {
  podId: string;
  podName: string;
  /** Anchor id on invite section for in-page scroll from primary CTA */
  onInviteClickId?: string;
}) {
  return (
    <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">Group cart created</h2>
      <p className="mt-3 text-base text-stone-600">
        Invite friends to add their items, or start adding yours now.
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Pod: <span className="font-medium text-stone-800">{podName}</span>
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {onInviteClickId ? (
          <a
            href={`#${onInviteClickId}`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          >
            Invite people
          </a>
        ) : null}
        <Link
          href={`/pod/${podId}`}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-50"
        >
          Add items
        </Link>
      </div>
    </div>
  );
}

export function GroupOrderParticipantEmptyCartState({ podId }: { podId: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-stone-900">You joined the group order</h2>
      <p className="mt-3 text-sm text-stone-600">Add your items when you&apos;re ready.</p>
      <Link
        href={`/pod/${podId}`}
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-stone-800"
      >
        Add items
      </Link>
    </div>
  );
}
