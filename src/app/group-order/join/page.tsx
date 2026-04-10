import Link from "next/link";
import { findActiveSessionByJoinCode, findSessionByIdForJoin } from "@/services/group-order.service";
import { joinGroupOrderFormAction } from "@/actions/group-order.actions";

export default async function GroupOrderJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; session?: string; error?: string }>;
}) {
  const { code, session: sessionId, error } = await searchParams;
  let session = sessionId ? await findSessionByIdForJoin(sessionId) : null;
  if (!session && code) {
    session = await findActiveSessionByJoinCode(code);
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold text-stone-900">Group order not found</h1>
        <p className="mt-2 text-sm text-stone-600">Ask the host for an updated code or link.</p>
        <Link href="/explore" className="mt-6 inline-block text-mennyu-primary underline">
          Explore pods
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-semibold text-stone-900">Join group order</h1>
      <p className="mt-2 text-sm text-stone-600">
        Pod: <span className="font-medium text-stone-800">{session.pod.name}</span>
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {decodeURIComponent(error)}
        </p>
      )}
      <form action={joinGroupOrderFormAction} className="mt-6 space-y-4">
        <input type="hidden" name="groupOrderSessionId" value={session.id} />
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-stone-800">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            placeholder="How you appear in the group cart"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-stone-800">
            Mobile number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            placeholder="For order-ready texts (not shown to others)"
          />
          <p className="mt-1 text-xs text-stone-500">
            Used to notify you when your items are ready. Not shared with the host or vendors.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-mennyu-primary py-3 text-sm font-semibold text-black hover:bg-mennyu-secondary"
        >
          Join &amp; continue
        </button>
      </form>
    </div>
  );
}
