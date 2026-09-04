import Image from "next/image";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[90rem] items-stretch px-0 sm:px-4 lg:px-8">
      <div className="grid w-full grid-cols-1 border-y border-border bg-background lg:min-h-[42rem] lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)] lg:border-x">
        <aside className="relative order-first flex min-h-64 overflow-hidden bg-neutral-950 p-6 text-white sm:min-h-80 sm:p-9 lg:order-last lg:min-h-full lg:p-12" aria-label="1968 Clothing account benefits">
          <Image src="/images/1968 Clothing Page Profile.webp" alt="1968 Clothing streetwear campaign" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-center opacity-55 grayscale" priority />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,.94)_10%,rgba(0,0,0,.35)_100%)]" />
          <div className="relative flex w-full flex-col justify-between">
            <div className="flex items-start justify-between font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/70"><span>1968 Clothing</span><span>Member access</span></div>
            <div className="max-w-md pt-12 lg:pt-0"><p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">Est. 1968 · Manila</p><h2 className="mt-4 max-w-md text-5xl font-black leading-[0.82] tracking-[-0.075em] text-white sm:text-6xl lg:text-7xl">Wear the legacy.<br />Move the culture.</h2><p className="mt-6 max-w-xs text-sm leading-6 text-white/75">Your private space for delivery details, payment evidence, and every order in motion.</p></div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3 border-t border-white/25 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-white/70"><span>01<br /><b className="mt-1 block text-white">Orders</b></span><span>02<br /><b className="mt-1 block text-white">Addresses</b></span><span>03<br /><b className="mt-1 block text-white">Receipts</b></span></div>
          </div>
        </aside>
        <section className="flex min-w-0 items-center bg-background px-5 py-10 sm:px-10 sm:py-14 lg:px-[clamp(3rem,7vw,8rem)] lg:py-16">{children}</section>
      </div>
    </main>
  );
}
