import { redirect } from "next/navigation";

/** Global list removed — menu imports are managed per vendor under Admin → Vendors → [vendor] → Menu. */
export default function AdminMenuImportsListRedirectPage() {
  redirect("/admin/vendors");
}
