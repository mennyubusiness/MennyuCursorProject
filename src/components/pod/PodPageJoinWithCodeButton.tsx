"use client";

import { useState } from "react";
import { JoinGroupOrderByCodeModal } from "@/components/group-order/JoinGroupOrderByCodeModal";
import { cn } from "@/lib/cn";

type PodPageJoinWithCodeButtonProps = {
  className?: string;
  label?: string;
};

export function PodPageJoinWithCodeButton({
  className,
  label = "Join with code",
}: PodPageJoinWithCodeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(className)}>
        {label}
      </button>
      <JoinGroupOrderByCodeModal open={open} onClose={() => setOpen(false)} overlayClassName="z-50" />
    </>
  );
}
