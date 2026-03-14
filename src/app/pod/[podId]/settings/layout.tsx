/**
 * Pod Settings: same access guard as pod dashboard.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminAllowed } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { PodAreaNav } from "../PodAreaNav";

function getAdminCookie(headersList: Headers): string | null {
  const cookie = headersList.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/mennyu_admin=([^;]+)/);
  const value = match?.[1]?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export default async function PodSettingsLayout({
  params,
  children,
}: {
  params: Promise<{ podId: string }>;
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const cookieValue = getAdminCookie(headersList);
  const allowed = isAdminAllowed(cookieValue, null);
  if (!allowed) {
    if (env.NODE_ENV === "production" && env.ADMIN_SECRET) {
      redirect("/admin/access-denied");
    }
  }

  const { podId } = await params;
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true },
  });
  if (!pod) notFound();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-stone-900">Pod Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">{pod.name}</p>
        </div>
        <PodAreaNav />
      </header>
      {children}
    </div>
  );
}
