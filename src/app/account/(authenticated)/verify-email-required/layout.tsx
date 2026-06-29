/** Wider, vertically centered shell for the email verification gate (hub tier is max-w-3xl). */
export default function VerifyEmailRequiredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center py-4 sm:py-8">
      {children}
    </div>
  );
}
