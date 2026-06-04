import Link from "next/link";
import { findActiveSessionByJoinCode, findSessionByIdForJoin } from "@/services/group-order.service";
import { GroupOrderJoinForm } from "./GroupOrderJoinForm";

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
