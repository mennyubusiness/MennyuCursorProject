import { DashboardShell } from "@/components/dashboard";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4.25rem)] bg-oo-cream">
      <DashboardShell tier="hub" className="py-8 sm:py-10">
        {children}
      </DashboardShell>
    </div>
  );
}
