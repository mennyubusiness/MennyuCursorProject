import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  findSessionByJoinCodeForJoinOrTracking,
  findSessionByIdForJoinOrTracking,
} from "@/services/group-order.service";
import {
  findOrderIdForGroupOrderSession,
  readGroupOrderParticipantMarkersFromRequest,
  resolveGroupParticipantForSession,
} from "@/lib/group-participant-order-access";
import { GroupOrderJoinForm } from "./GroupOrderJoinForm";

export default async function GroupOrderJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; session?: string; error?: string }>;
}) {
  const { code, session: sessionId, error } = await searchParams;
  let session = sessionId ? await findSessionByIdForJoinOrTracking(sessionId) : null;
  if (!session && code) {
    session = await findSessionByJoinCodeForJoinOrTracking(code);
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold text-stone-900">Group order not found</h1>
        <p className="mt-2 text-sm text-stone-600">Ask the host for an updated code or link.</p>
        <Link href="/explore" className="mt-6 inline-block text-stone-900 underline">
          Explore pods
        </Link>
      </div>
    );
  }

  if (session.status === "submitted") {
    const cookieStore = await cookies();
    const markers = readGroupOrderParticipantMarkersFromRequest(cookieStore);
    const participant = await resolveGroupParticipantForSession(session.id, markers);
    const orderId = await findOrderIdForGroupOrderSession(session.id);
    if (participant?.role === "participant" && orderId) {
      redirect(`/order/${orderId}`);
    }

    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold text-stone-900">Group order placed</h1>
        <p className="mt-2 text-sm text-stone-600">
          This group order has already been placed.
        </p>
        <p className="mt-3 text-sm text-stone-600">
          {orderId && participant?.role === "participant"
            ? "Opening your order tracking…"
            : "Ask the host for the tracking link, or open this page on the device you used to join and add items."}
        </p>
        {orderId ? (
          <Link
            href={`/order/${orderId}`}
            className="mt-6 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Track order
          </Link>
        ) : null}
        <Link href="/explore" className="mt-4 block text-sm text-stone-600 underline">
          Explore pods
        </Link>
      </div>
    );
  }

  if (session.status !== "active" || session.expiresAt <= new Date()) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold text-stone-900">Group order closed</h1>
        <p className="mt-2 text-sm text-stone-600">
          This group order is no longer open for new items.
        </p>
        <Link href="/explore" className="mt-6 inline-block text-stone-900 underline">
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
      <GroupOrderJoinForm groupOrderSessionId={session.id} />
    </div>
  );
}
