export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="store-container flex flex-1 items-start justify-center py-5 sm:py-9 lg:py-12">
      <div className="w-full max-w-[29rem] rounded-md border border-border/80 bg-background px-5 py-6 sm:px-8 sm:py-8">
        {children}
      </div>
    </main>
  );
}
