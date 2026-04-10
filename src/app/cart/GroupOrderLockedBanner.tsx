export function GroupOrderLockedBanner({
  locked,
  viewerIsHost,
}: {
  locked: boolean;
  viewerIsHost: boolean;
}) {
  if (!locked) return null;
  return (
    <div
      className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"
      role="status"
    >
      <p className="font-semibold">
        {viewerIsHost
          ? "Your group order is locked while checkout is in progress."
          : "This group order is locked while the host completes checkout."}
      </p>
      <p className="mt-1 text-sky-900/90">
        {viewerIsHost
          ? "Finish paying or use “Back to cart” from checkout to unlock and let others edit again."
          : "You can watch the cart update, but items can’t be changed until the host returns from checkout."}
      </p>
    </div>
  );
}
