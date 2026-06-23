import Link from "next/link";

import { buildPodCustomerPath } from "@/lib/customer-public-url";

export function GroupOrderParticipantEmptyCartState({ podSlug }: { podSlug: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-stone-900">You joined the group order</h2>
      <p className="mt-3 text-sm text-stone-600">Add your items when you&apos;re ready.</p>
      <Link
        href={buildPodCustomerPath(podSlug)}
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-stone-800"
      >
        Add items
      </Link>
    </div>
  );
}
