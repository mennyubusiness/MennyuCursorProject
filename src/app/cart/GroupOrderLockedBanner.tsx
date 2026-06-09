export function GroupOrderLockedBanner({
  locked,
  viewerIsHost,
  showReviewHint,
}: {
  locked: boolean;
  viewerIsHost: boolean;
  showReviewHint?: boolean;
}) {
  if (showReviewHint && viewerIsHost) {
    return (
      <div
        className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        role="status"
      >
        <p className="font-semibold">Review the latest group cart before checkout.</p>
        <p className="mt-1 text-amber-900/90">
          The cart was updated while checkout was in progress. Confirm everyone&apos;s items, then
          check out again.
        </p>
      </div>
    );
  }

  if (!locked) return null;
  return (
    <div
      className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"
      role="status"
    >
      <p className="font-semibold">
        {viewerIsHost
          ? "Checkout is in progress. Return to checkout or unlock to edit."
          : "The host is checking out. New changes are paused."}
      </p>
      <p className="mt-1 text-sky-900/90">
        {viewerIsHost
          ? "Participants can still view the cart but cannot add or change items."
          : "The host is checking out. Joining is paused for new guests."}
      </p>
    </div>
  );
}
