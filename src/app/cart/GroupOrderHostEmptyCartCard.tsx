import Link from "next/link";
import QRCode from "qrcode";
import { endGroupOrderHostFormAction } from "@/actions/group-order.actions";
import { EndGroupOrderHostButton } from "@/components/cart/EndGroupOrderHostButton";
import { ButtonLink } from "@/components/ui/button";
import type { GroupOrderStateForCartPage } from "@/lib/group-order-cart-page";
import { buildGroupOrderJoinAbsoluteUrl } from "@/lib/group-order-invite-url";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { cn } from "@/lib/cn";
import { GROUP_INVITE_SECTION_ID } from "./GroupOrderCartPanel";
import { GroupOrderInviteShareControls } from "./GroupOrderInviteShareControls";

async function buildGroupInviteQrDataUrl(inviteAbsoluteUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(inviteAbsoluteUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1f1f1cff", light: "#faf9f6ff" },
    });
  } catch {
    return "";
  }
}

const endGroupOrderButtonClass =
  "rounded-lg border border-oo-light-stone bg-transparent px-2.5 py-1.5 text-xs font-medium text-oo-stone-gray hover:bg-oo-cream hover:text-oo-charcoal disabled:opacity-60";

export async function GroupOrderHostEmptyCartCard({
  cartId,
  podId,
  podName,
  goState,
}: {
  cartId: string;
  podId: string;
  podName: string;
  goState: GroupOrderStateForCartPage;
}) {
  if (!goState.active || goState.view !== "host" || !("joinCode" in goState)) {
    return null;
  }

  const isLocked = goState.status === "locked_checkout";
  const origin = await getPublicSiteOrigin();
  const inviteAbsoluteUrl = buildGroupOrderJoinAbsoluteUrl(origin, goState.joinCode);
  const qrDataUrl = await buildGroupInviteQrDataUrl(inviteAbsoluteUrl);

  return (
    <section
      className="mt-6 rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-[0_8px_32px_-14px_rgba(31,31,28,0.12)]"
      aria-labelledby="group-empty-cart-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-oo-light-stone px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
              isLocked
                ? "border border-sky-200 bg-sky-50 text-sky-950"
                : "border border-emerald-200 bg-emerald-50 text-emerald-900"
            )}
          >
            {isLocked ? "Checkout in progress" : "Group order open"}
          </span>
          <span className="text-xs text-oo-stone-gray">Host pays at checkout</span>
        </div>
        {!isLocked && (
          <>
            <EndGroupOrderHostButton cartId={cartId} className={endGroupOrderButtonClass} />
            <noscript>
              <form action={endGroupOrderHostFormAction} className="shrink-0">
                <input type="hidden" name="cartId" value={cartId} />
                <button type="submit" className={endGroupOrderButtonClass}>
                  End group order
                </button>
              </form>
            </noscript>
          </>
        )}
      </header>

      <div className="px-5 py-8 text-center sm:px-6 sm:py-10">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-oo-light-stone bg-oo-cream text-oo-stone-gray"
          aria-hidden
        >
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
            />
          </svg>
        </div>

        <h1
          id="group-empty-cart-heading"
          className="mt-4 text-2xl font-bold tracking-tight text-oo-charcoal sm:text-[1.65rem]"
        >
          Your group cart is empty
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-oo-stone-gray sm:text-base">
          Add items from any vendor at {podName}, or invite friends to add their own.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <ButtonLink href={`/pod/${podId}`} variant="primary" size="md" className="w-full sm:w-auto">
            Add items
          </ButtonLink>
          <Link
            href={`#${GROUP_INVITE_SECTION_ID}`}
            className={cn(
              "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-5 py-2.5 text-sm font-semibold text-oo-charcoal transition-colors hover:border-oo-stone-gray hover:bg-oo-cream sm:w-auto"
            )}
          >
            Invite people
          </Link>
        </div>
      </div>

      <div className="border-t border-oo-light-stone px-5 py-5 sm:px-6 sm:py-6">
        <div id={GROUP_INVITE_SECTION_ID} className="scroll-mt-24">
          <GroupOrderInviteShareControls
            variant="compact"
            joinCode={goState.joinCode}
            inviteAbsoluteUrl={inviteAbsoluteUrl}
            podName={podName}
            qrDataUrl={qrDataUrl}
          />
        </div>
      </div>
    </section>
  );
}
