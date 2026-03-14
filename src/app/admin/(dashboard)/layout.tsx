import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdminAllowed } from "@/lib/admin-auth";
import { env } from "@/lib/env";

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

export default async function AdminDashboardLayout({
  children,
}: {
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

  return <>{children}</>;
}
