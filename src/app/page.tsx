import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-12 py-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-black">Mennyu</h1>
        <p className="mt-4 text-lg text-stone-700">
          Order from multiple vendors in a shared food pod. One cart, one payment, one pickup.
        </p>
        <Link
          href="/explore"
          className="mt-6 inline-block rounded-lg bg-mennyu-primary px-6 py-3 font-medium text-black hover:bg-mennyu-secondary"
        >
          Explore food pods
        </Link>
      </section>

      <section className="rounded-xl border border-stone-200 bg-mennyu-muted p-6">
        <h2 className="text-lg font-semibold text-black">How it works</h2>
        <ul className="mt-4 space-y-3 text-stone-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-semibold text-black">
              1
            </span>
            <span><strong>Browse pods</strong> — Find a food pod near you and see its vendors.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-semibold text-black">
              2
            </span>
            <span><strong>Order from multiple vendors</strong> — Add items from different vendors into one cart.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-semibold text-black">
              3
            </span>
            <span><strong>One pickup</strong> — Pay once and pick up with a single code.</span>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-black">For everyone</h2>
        <p className="mt-2 text-sm text-stone-600">
          <strong>Customers</strong> get one place to order from their favorite pod.{" "}
          <strong>Vendors</strong> reach more customers and manage orders in one place.{" "}
          <strong>Pod owners</strong> bring together vendors and streamline pickup.
        </p>
      </section>
    </div>
  );
}
