import Link from "next/link";
import { startGroupOrderFormAction, leaveGroupOrderFormAction, endGroupOrderHostFormAction } from "@/actions/group-order.actions";
import type { GroupOrderCartReadModel } from "@/lib/group-order-cart-read-model";
import { HostParticipantBreakdown } from "./HostParticipantBreakdown";

type GoState =
  | { active: false }
  | {
      active: true;
      sessionId: string;
      joinCode: string;
      status: string;
      podId: string;
      participants: Array<{ id: string; displayName: string; isHost: boolean }>;
      isHost: boolean;
    };

export async function GroupOrderCartPanel({
  cartId,
  podId,
  goState,
  canStartGroup,
  readModel,
  locked,
}: {
  cartId: string;
  podId: string;
  goState: GoState;
  canStartGroup: boolean;
  readModel: GroupOrderCartReadModel | null;
  locked: boolean;
}) {
  if (!goState.active) {
    if (!canStartGroup) return null;
    return (
      <section className="mb-6 rounded-xl border border-dashed border-stone-300 bg-stone-50/80 p-4 text-sm text-stone-700">
        <p className="font-medium text-stone-900">Group order</p>
        <p className="mt-1 text-stone-600">
          Share one cart for this pod: you pay once at checkout; friends add their own items using a link or code.
          Everyone must order from this pod only.
        </p>
        <form className="mt-3" action={startGroupOrderFormAction}>
          <input type="hidden" name="cartId" value={cartId} />
          <input type="hidden" name="podId" value={podId} />
          <button
            type="submit"
            className="rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            Start group order
          </button>
        </form>
      </section>
    );
  }

  const joinUrl = `/group-order/join?session=${goState.sessionId}`;
  const isParticipantOnly = goState.active && !goState.isHost;

  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-stone-900">Group order · {locked ? "locked" : "open"}</p>
          <p className="mt-1 font-mono text-xs text-stone-600">
            Code: <span className="font-semibold">{goState.joinCode}</span>
          </p>
          <p className="mt-1 text-xs text-stone-600">
            <Link href={joinUrl} className="text-mennyu-primary underline">
              Join link
            </Link>
            <span className="text-stone-400"> · </span>
            <span>Same link works for QR.</span>
          </p>
        </div>
        {goState.isHost && (
          <form action={endGroupOrderHostFormAction} className="shrink-0">
            <input type="hidden" name="cartId" value={cartId} />
            <button
              type="submit"
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
            >
              End group order
            </button>
          </form>
        )}
        {isParticipantOnly && (
          <form action={leaveGroupOrderFormAction} className="shrink-0">
            <button
              type="submit"
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50"
            >
              Leave group
            </button>
          </form>
        )}
      </div>

      {goState.isHost && (
        <p className="mt-3 text-stone-600">
          You&apos;re the host — you&apos;ll pay for everyone at checkout. Participants can add or change their own
          items until you start checkout (then the cart locks).
        </p>
      )}
      {isParticipantOnly && (
        <p className="mt-3 text-stone-600">
          The host completes payment for this order. You can edit your own items until checkout begins. You won&apos;t
          see the full order total — only your food and your share of the tip (shown below).
        </p>
      )}

      {locked && (
        <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
          {goState.isHost
            ? "Checkout in progress — the cart is locked for everyone until you finish or return from checkout."
            : "Checkout in progress — editing is paused until the host finishes or comes back."}
        </p>
      )}

      {goState.isHost && readModel && <HostParticipantBreakdown model={readModel} />}
    </section>
  );
}
