import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";

export default async function VendorSelectPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginHrefWithReturn("/vendor/select"));
  }

  const rows = await prisma.vendorMembership.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { vendor: { select: { name: true, slug: true } } },
  });

  if (rows.length === 0) {
    redirect(buildLoginHrefWithReturn("/vendor/select"));
  }

  if (rows.length === 1) {
    redirect(`/vendor/${rows[0].vendorId}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold text-oo-charcoal">Choose a restaurant</h1>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Your account is linked to more than one vendor. Pick where you want to go.
      </p>
      <ul className="mt-6 divide-y divide-oo-light-stone rounded-lg border border-oo-light-stone bg-oo-warm-white">
        {rows.map((r) => (
          <li key={r.vendorId}>
            <Link
              href={`/vendor/${r.vendorId}`}
              className="flex flex-col gap-0.5 px-4 py-3 text-sm hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">{r.vendor.name}</span>
              <span className="text-xs text-oo-stone-gray">{r.vendor.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-oo-stone-gray">
        <Link href="/login" className="text-sky-800 underline hover:text-sky-900">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
