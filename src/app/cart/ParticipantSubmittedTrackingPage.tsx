import Link from "next/link";
import { GroupOrderSubmittedRedirect } from "./GroupOrderSubmittedRedirect";
import { GroupOrderCartPanel } from "./GroupOrderCartPanel";
import type { GroupOrderStateForCartPage } from "@/lib/group-order-cart-page";
import { CheckoutProgress } from "../checkout/CheckoutProgress";

export function ParticipantSubmittedTrackingPage({
  cartId,
  podId,
  podName,
  goState,
  canStartGroup,
  submittedOrderId,
}: {
  cartId: string;
  podId: string;
  podName: string;
  goState: GroupOrderStateForCartPage;
  canStartGroup: boolean;
  submittedOrderId: string | null;
}) {
  const pollEnabled =
    goState.active &&
    goState.view === "participant" &&
    (goState.status === "active" ||
      goState.status === "locked_checkout" ||
      goState.status === "submitted");

  return (
    <div className="mx-auto max-w-2xl pb-28 sm:pb-10">
      <GroupOrderSubmittedRedirect
        enabled={pollEnabled}
        cartId={cartId}
        initialSessionStatus={goState.active ? goState.status : "active"}
        initialSubmittedOrderId={submittedOrderId}
      />
      <CheckoutProgress activeStep={1} className="pt-3 sm:pt-4" />
      <GroupOrderCartPanel
        cartId={cartId}
        podId={podId}
        podName={podName}
        goState={goState}
        canStartGroup={canStartGroup}
        readModel={null}
        locked={goState.active ? goState.status === "locked_checkout" : false}
      />
      {!submittedOrderId ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm text-emerald-950">
          <p className="font-semibold">The host placed this group order.</p>
          <p className="mt-2 text-emerald-900/90">Opening order tracking…</p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm text-emerald-950">
          <p className="font-semibold">The host placed this group order.</p>
          <Link
            href={`/order/${submittedOrderId}`}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Track order
          </Link>
        </div>
      )}
    </div>
  );
}
