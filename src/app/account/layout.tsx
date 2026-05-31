export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4.25rem)] bg-[#EDE6DC]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">{children}</div>
    </div>
  );
}
