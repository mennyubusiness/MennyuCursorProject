import { MarqueeBanner } from "@/components/admin/MarqueeBanner";

const ADMIN_MODE_SEGMENT = "ADMIN MODE";

const MARQUEE_ITEMS = Array.from({ length: 8 }, () => ADMIN_MODE_SEGMENT);

type AdminModeBannerProps = {
  /** Sticky at top of viewport (operational dashboards). */
  sticky?: boolean;
};

/**
 * Prominent yellow admin warning marquee — only mount when server auth confirms admin context.
 */
export function AdminModeBanner({ sticky = false }: AdminModeBannerProps) {
  return (
    <MarqueeBanner
      items={MARQUEE_ITEMS}
      tone="admin"
      ariaLabel="Admin mode. You are using admin controls."
      className={sticky ? "sticky top-0 z-40" : undefined}
    />
  );
}
