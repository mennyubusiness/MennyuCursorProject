import Link from "next/link";
import QRCode from "qrcode";
import { startGroupOrderFormAction, leaveGroupOrderFormAction, endGroupOrderHostFormAction } from "@/actions/group-order.actions";
import { EndGroupOrderHostButton } from "@/components/cart/EndGroupOrderHostButton";
import type { GroupOrderCartReadModel } from "@/lib/group-order-cart-read-model";
import type { GroupOrderStateForCartPage } from "@/lib/group-order-cart-page";
import { buildGroupOrderJoinAbsoluteUrl } from "@/lib/group-order-invite-url";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { HostParticipantBreakdown } from "./HostParticipantBreakdown";
import { GroupOrderInviteShareControls } from "./GroupOrderInviteShareControls";

const GROUP_INVITE_SECTION_ID = "group-order-invite";

async function buildGroupInviteQrDataUrl(inviteAbsoluteUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(inviteAbsoluteUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1917ff", light: "#ffffffff" },
    });
  } catch {
    return "";
  }
}

function ClosedGroupOrderPanel({
  title,
  body,
  exploreHref = "/explore",
}: {
  title: string;
  body: string;
  exploreHref?: string;
}) {
  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-800 shadow-sm">
      <p className="font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-stone-600">{body}</p>
      <Link
        href={exploreHref}
        className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-stone-900 underline"
      >
        Explore pods
      </Link>
    </section>
  );
}

export async function GroupOrderCartPanel({
  cartId,
  podId,
  podName,
  goState,
  canStartGroup,
  readModel,
  locked,
}: {
  cartId: string;
  podId: string;
  podName: string;
  goState: GroupOrderStateForCartPage;
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

  const isHost = goState.view === "host";
  const isParticipant = goState.view === "participant";
  const isUnknown = goState.view === "unknown";
  const isSubmitted = goState.status === "submitted";
  const isEnded = goState.status === "ended";
  const isExpired = goState.status === "expired";
  const isLockedCheckout = goState.status === "locked_checkout" || locked;
  const trackHref =
    "submittedOrderId" in goState && goState.submittedOrderId
      ? `/order/${goState.submittedOrderId}`
      : null;

  let hostInviteProps: {
    joinCode: string;
    inviteAbsoluteUrl: string;
    qrDataUrl: string;
  } | null = null;
  if (isHost && goState.view === "host" && "joinCode" in goState) {
    const origin = await getPublicSiteOrigin();
    const inviteAbsoluteUrl = buildGroupOrderJoinAbsoluteUrl(origin, goState.joinCode);
    hostInviteProps = {
      joinCode: goState.joinCode,
      inviteAbsoluteUrl,
      qrDataUrl: await buildGroupInviteQrDataUrl(inviteAbsoluteUrl),
    };
  }

  if (isEnded) {
    if (isUnknown) return null;
    return (
      <ClosedGroupOrderPanel
        title="This group order was ended."
        body={
          isHost
            ? "Start a new group order from this cart when you're ready."
            : "The host ended this group order before checkout."
        }
      />
    );
  }

  if (isExpired) {
    if (isUnknown) return null;
    return (
      <ClosedGroupOrderPanel
        title="This group order expired."
        body={
          isHost
            ? "Start a new group order to share a fresh code with your group."
            : "Ask the host to start a new group order."
        }
      />
    );
  }

  if (isSubmitted) {
    if (isUnknown) return null;
    return (
      <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 shadow-sm">
        <p className="font-semibold text-emerald-950">
          {isHost ? "You placed this group order." : "The host placed this group order."}
        </p>
        <p className="mt-1 text-emerald-900/90">
          {isParticipant
            ? "You can track the order status now. You're viewing your items in this group order."
            : isHost
              ? "Track pickup and vendor status for everyone in this group order."
              : "This group order has already been placed."}
        </p>
        {trackHref ? (
          <Link
            href={trackHref}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Track order
          </Link>
        ) : (
          <p className="mt-3 text-xs text-emerald-900/80">Ask the host for the tracking link.</p>
        )}
        {!trackHref && !isHost && (
          <p className="mt-2 text-xs text-emerald-900/80">
            Join with the same device you used when adding items to open tracking.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-stone-900">
            Group order · {isLockedCheckout ? "checkout in progress" : "open"}
          </p>
          {isHost && hostInviteProps ? null : isUnknown ? (
            <p className="mt-1 text-xs text-stone-600">
              Join with the host&apos;s code or link to add your items. You won&apos;t see other people&apos;s lines
              until you join.
            </p>
          ) : null}
          {isParticipant && (
            <p className="mt-1 text-xs text-stone-600">
              Signed in as <span className="font-medium text-stone-800">{goState.viewerDisplayName}</span>
            </p>
          )}
        </div>
        {isHost && !isLockedCheckout && (
          <>
            <EndGroupOrderHostButton cartId={cartId} />
            <noscript>
              <form action={endGroupOrderHostFormAction} className="shrink-0">
                <input type="hidden" name="cartId" value={cartId} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                >
                  End group order
                </button>
              </form>
            </noscript>
          </>
        )}
        {isParticipant && !isLockedCheckout && (
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

      {isHost && (
        <p className="mt-3 text-stone-600">
          You&apos;re the host — you&apos;ll pay for everyone at checkout. Participants can add or change their own
          items until you start checkout (then the cart locks).
        </p>
      )}
      {isParticipant && (
        <p className="mt-3 text-stone-600">
          You&apos;re adding items to this group order. Only you can see your lines here — the host reviews the full
          cart and completes payment.
        </p>
      )}

      {isLockedCheckout && (
        <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
          {isHost
            ? "Checkout is in progress. Return to checkout or unlock to edit."
            : "The host is checking out. New changes are paused."}
        </p>
      )}

      {isHost && hostInviteProps ? (
        <div id={GROUP_INVITE_SECTION_ID}>
          <GroupOrderInviteShareControls
            joinCode={hostInviteProps.joinCode}
            inviteAbsoluteUrl={hostInviteProps.inviteAbsoluteUrl}
            podName={podName}
            qrDataUrl={hostInviteProps.qrDataUrl}
          />
        </div>
      ) : null}

      {isHost && readModel && <HostParticipantBreakdown model={readModel} />}
    </section>
  );
}

export { GROUP_INVITE_SECTION_ID };
