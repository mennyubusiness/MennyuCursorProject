/** Subtle pulse blocks for loading shells — Tailwind-only, no extra deps. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-stone-200/75 ${className}`} aria-hidden />
  );
}
