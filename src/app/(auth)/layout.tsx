import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.02fr_0.98fr]">
      <div className="flex flex-col px-5 py-7 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[390px]">{children}</div>
        </div>
        <p className="text-[11.5px] text-muted">© {new Date().getFullYear()} uzbook.online</p>
      </div>

      <aside className="hidden p-3 lg:block">
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[32px] bg-ink p-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_0%,rgba(110,86,248,0.45),transparent_65%),radial-gradient(40%_40%_at_20%_100%,rgba(18,184,134,0.18),transparent_70%)]" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[10.5px] font-medium tracking-[0.14em] uppercase ring-1 ring-white/10">
              <span className="size-1.5 rounded-full bg-brand" /> uzbook для бизнеса
            </span>
            <h2 className="mt-8 max-w-sm text-[34px] leading-[1.06] font-semibold tracking-[-0.03em]">
              День салона виден
              <span className="font-serif font-medium italic text-white/70"> с одного экрана</span>
            </h2>
          </div>

          <div className="relative mt-10 space-y-2.5">
            {[
              { time: "10:00", name: "Мадина", service: "Окрашивание · 2 ч", accent: "bg-brand/25" },
              { time: "12:30", name: "Тимур", service: "Стрижка · 45 мин", accent: "bg-mint/25" },
              { time: "14:00", name: "Азиза", service: "Маникюр · 1 ч", accent: "bg-amber/25" },
            ].map((row) => (
              <div
                key={row.time}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10"
              >
                <span className="w-11 text-[11.5px] text-white/55">{row.time}</span>
                <span className={`h-8 w-1 rounded-full ${row.accent}`} />
                <div>
                  <p className="text-[12.5px] font-medium">{row.name}</p>
                  <p className="text-[11px] text-white/45">{row.service}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-10 flex items-center justify-between text-[11.5px] text-white/40">
            <span>Записи приходят сами</span>
            <span>uzbook.online</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
