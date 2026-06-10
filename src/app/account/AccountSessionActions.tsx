"use client";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function AccountSessionActions() {
  return (
    <CustomerSignOutForm
      className={cn(buttonClassName({ variant: "secondary", size: "sm" }), "w-full sm:w-auto")}
    />
  );
}
