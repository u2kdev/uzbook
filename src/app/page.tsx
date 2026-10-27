import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Copy,
  Link2,
  Scissors,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { PLANS, formatMoney } from "@/lib/plans";

const CATEGORIES = [
  "Барбершопы",
  "Салоны красоты",
  "Стоматологии",
  "Мастера маникюра",
  "Массаж",
  "Фотографы",
];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Таймлайн дня",
    text: "Все записи на одном экране: кто, во сколько, к какому мастеру и на сколько. Никаких переписок в блокноте.",
  },
  {
    icon: Clock3,
    title: "Слоты с учётом длительности",
    text: "Стрижка 45 минут, окрашивание 3 часа — система сама не предложит время, в которое услуга не влезает.",
  },
  {
    icon: BellRing,
    title: "Напоминания в Telegram",
    text: "Клиент получает подтверждение и напоминание. Вы видите, кто записался, без звонков.",
  },
  {
    icon: UserRound,
    title: "Без логина для клиента",
    text: "Персональная ссылка на запись: перенести или отменить можно в один клик, подтвердив номер телефона.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(80%_50%_at_50%_-10%,rgba(110,86,248,0.14),transparent_60%),radial-gradient(50%_40%_at_100%_20%,rgba(18,184,134,0.08),transparent_60%)]" />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:pt-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border border-white/60 bg-white/75 py-2.5 pr-2.5 pl-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_50px_-30px_rgba(11,11,16,0.45)] backdrop-blur-xl">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-ink-soft md:flex">
            <a href="#features" className="transition-colors hover:text-ink">
              Возможности
            </a>
            <a href="#how" className="transition-colors hover:text-ink">
              Как работает
            </a>
            <a href="#pricing" className="transition-colors hover:text-ink">
              Тарифы
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-quiet hidden sm:inline-flex">
              Войти
            </Link>
            <Link href="/register" className="btn btn-primary h-10 px-4 text-[13px]">
              Создать страницу
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ---------------------------------------------------------------- */}
        <section className="container-page pt-16 pb-20 sm:pt-24 lg:pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="animate-rise">
              <span className="badge">
                <span className="size-1.5 rounded-full bg-brand" />
                Запись · Telegram · Без звонков
              </span>

              <h1 className="mt-6 text-[clamp(2.6rem,6.4vw,4.4rem)] leading-[0.98] font-semibold">
                Ваша запись работает,
                <br />
                пока вы{" "}
                <span className="font-serif font-medium italic text-brand">работаете</span>
              </h1>

              <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-muted">
                Страница вашего салона, услуги с длительностью, мастера и свободное время.
                Клиент выбирает слот сам — вы просто смотрите день в таймлайне.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn btn-primary group h-12 px-3 pl-6">
                  Создать страницу салона
                  <span className="grid size-8 place-items-center rounded-full bg-white/12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-px">
                    <ArrowUpRight size={16} strokeWidth={1.6} />
                  </span>
                </Link>
                <Link href="/atelier-noir" className="btn btn-ghost h-12">
                  Посмотреть пример
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13px] text-muted">
                <span className="inline-flex items-center gap-2">
                  <Check size={15} strokeWidth={1.8} className="text-mint" /> 14 дней бесплатно
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={15} strokeWidth={1.8} className="text-mint" /> Без карты
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check size={15} strokeWidth={1.8} className="text-mint" /> Настройка за вечер
                </span>
              </div>
            </div>

            {/* Z-axis cascade of product surfaces */}
            <div className="relative mx-auto w-full max-w-[430px] lg:max-w-none">
              <div className="absolute -top-6 -right-2 hidden rotate-6 rounded-[26px] border border-white/70 bg-white/70 p-3 shadow-soft backdrop-blur-sm sm:block">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-mint/10 text-mint">
                    <Check size={16} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold">Новая запись</p>
                    <p className="text-[11px] text-muted">Окрашивание · 14:30</p>
                  </div>
                </div>
              </div>

              <div className="animate-rise rounded-[2rem] border border-white/70 bg-white/55 p-2 shadow-lift backdrop-blur-[2px] [animation-delay:120ms]">
                <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 ring-1 ring-black/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#2b2b35] to-[#5c5c6d] text-[13px] font-semibold text-white">
                        AN
                      </span>
                      <div>
                        <p className="text-[14px] font-semibold">Atelier Noir</p>
                        <p className="text-[11.5px] text-muted">Салон красоты · Ташкент</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-mint/10 px-2 py-1 text-[10.5px] font-medium text-mint">
                      <span className="size-1.5 rounded-full bg-mint" /> открыто
                    </span>
                  </div>

                  <div className="mt-5 h-px bg-line" />

                  <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Свободно сегодня
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {["11:30", "14:00", "16:30"].map((time, i) => (
                      <div
                        key={time}
                        className={`rounded-xl border py-2.5 text-center text-[13px] font-medium ${
                          i === 1
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-white text-ink-soft"
                        }`}
                      >
                        {time}
                      </div>
                    ))}
                  </div>

                  <p className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Мастера
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { name: "Мадина", role: "Колорист", slots: "14:00, 16:30", color: "#8f7bff" },
                      { name: "Тимур", role: "Барбер", slots: "15:00, 18:00", color: "#12b886" },
                    ].map((master) => (
                      <div
                        key={master.name}
                        className="flex items-center gap-3 rounded-2xl border border-line/80 bg-paper/60 p-2.5"
                      >
                        <span
                          className="grid size-9 place-items-center rounded-full text-[11px] font-semibold text-white"
                          style={{ background: master.color }}
                        >
                          {master.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold">{master.name}</p>
                          <p className="text-[11px] text-muted">{master.role}</p>
                        </div>
                        <span className="text-[11px] font-medium text-brand">{master.slots}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative z-10 -mt-7 ml-4 w-[88%] rotate-[-2.5deg] rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-lift backdrop-blur-sm transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:rotate-0">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold">Сегодня, 14:30 — 17:30</p>
                  <span className="text-[10.5px] text-muted">3 записи</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <div className="h-9 flex-[2] rounded-lg bg-brand/15 ring-1 ring-brand/20" />
                  <div className="h-9 flex-1 rounded-lg bg-amber/15 ring-1 ring-amber/25" />
                  <div className="h-9 flex-[1.6] rounded-lg bg-mint/15 ring-1 ring-mint/25" />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted">
                  <span>14:00</span>
                  <span>16:00</span>
                  <span>18:00</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-7 text-[12.5px] font-medium tracking-wide text-muted uppercase">
            <span className="text-[10.5px] tracking-[0.18em]">Уже подходит для</span>
            {CATEGORIES.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-line" />
                {c}
              </span>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section id="features" className="container-page py-24 sm:py-32">
          <Reveal>
            <span className="badge">Возможности</span>
            <h2 className="mt-5 max-w-2xl text-[clamp(2rem,4.4vw,3.1rem)] leading-[1.05] font-semibold">
              Всё, что нужно, чтобы день не рассыпался
            </h2>
            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted">
              Без CRM на 200 кнопок. Только то, что реально используется каждый день в салоне.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-6">
            <Reveal className="md:col-span-4" delay={60}>
              <div className="group h-full rounded-[28px] bg-white/60 p-1.5 ring-1 ring-black/[0.05] transition-shadow duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lift">
                <div className="flex h-full flex-col justify-between gap-8 rounded-[calc(28px-6px)] bg-white p-7 ring-1 ring-black/[0.03] sm:p-9">
                  <div>
                    <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
                      <CalendarClock size={21} strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-6 text-2xl font-semibold">Таймлайн вместо блокнота</h3>
                    <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
                      Открываете день и сразу видите загрузку команды. Подтверждение, перенос,
                      отметка «пришёл» — в один клик.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-paper p-4">
                    <div className="grid grid-cols-[64px_1fr] gap-3">
                      <div className="space-y-6 pt-1 text-[10.5px] text-muted">
                        <p>10:00</p>
                        <p>12:00</p>
                        <p>14:00</p>
                        <p>16:00</p>
                      </div>
                      <div className="relative h-[132px] overflow-hidden rounded-xl bg-[linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] bg-[length:100%_33px]">
                        <div className="absolute top-1 left-0 h-8 w-[62%] rounded-lg bg-brand/15 px-2 py-1.5 text-[10px] font-medium text-brand-dark ring-1 ring-brand/20">
                          Мадина · окрашивание
                        </div>
                        <div className="absolute top-[42px] left-[38%] h-7 w-[48%] rounded-lg bg-mint/15 px-2 py-1 text-[10px] font-medium text-mint ring-1 ring-mint/20">
                          Тимур · стрижка
                        </div>
                        <div className="absolute top-[84px] left-[8%] h-9 w-[54%] rounded-lg bg-amber/15 px-2 py-1.5 text-[10px] font-medium text-amber ring-1 ring-amber/20">
                          Мадина · уход
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={120}>
              <div className="flex h-full flex-col rounded-[28px] bg-white/60 p-1.5 ring-1 ring-black/[0.05]">
                <div className="flex h-full flex-col rounded-[calc(28px-6px)] bg-white p-7 ring-1 ring-black/[0.03]">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#eef8f4] text-mint">
                    <Link2 size={21} strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-6 text-xl font-semibold">Одна ссылка</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">
                    Ставите в Instagram, Telegram и на визитку.
                  </p>
                  <div className="mt-auto pt-6">
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
                      <Store size={14} strokeWidth={1.6} className="text-muted" />
                      <span className="truncate text-[12px] font-medium">
                        uzbook.online/atelier-noir
                      </span>
                      <Copy size={13} strokeWidth={1.6} className="ml-auto text-muted" />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {FEATURES.map((feature, index) => (
              <Reveal
                key={feature.title}
                className={index === 0 ? "md:col-span-3" : "md:col-span-3"}
                delay={80 + index * 40}
              >
                <div className="h-full rounded-[28px] bg-white/60 p-1.5 ring-1 ring-black/[0.05]">
                  <div className="flex h-full flex-col rounded-[calc(28px-6px)] bg-white p-7 ring-1 ring-black/[0.03]">
                    <span className="grid size-10 place-items-center rounded-xl bg-paper text-ink-soft">
                      <feature.icon size={19} strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-5 text-[17px] font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{feature.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section id="how" className="container-page py-24 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <span className="badge">Как это работает</span>
              <h2 className="mt-5 text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.06] font-semibold">
                От регистрации до первой записи — один вечер
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Конструктор страницы уже собран. Вы заполняете услуги, добавляете мастеров и
                включаете график — всё остальное делает система.
              </p>
            </Reveal>

            <div className="space-y-3">
              {[
                {
                  n: "01",
                  title: "Собираете мини-страницу",
                  text: "Название, фото, адрес, услуги и цены — готовый шаблон под ваш тип бизнеса.",
                },
                {
                  n: "02",
                  title: "Добавляете мастеров и графики",
                  text: "Рабочие часы, перерывы, выходные. Для каждой услуги — своя длительность.",
                },
                {
                  n: "03",
                  title: "Делитесь ссылкой",
                  text: "Клиент выбирает мастера, услугу и свободное время. Вы получаете уведомление.",
                },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 90}>
                  <div className="group flex gap-5 rounded-[24px] border border-transparent bg-white/70 p-6 ring-1 ring-black/[0.04] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-line hover:bg-white hover:shadow-soft">
                    <span className="font-serif text-2xl text-brand/50">{step.n}</span>
                    <div>
                      <h3 className="text-[16px] font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{step.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section id="pricing" className="container-page py-24 sm:py-32">
          <Reveal className="text-center">
            <span className="badge">Тарифы</span>
            <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2rem,4.4vw,3rem)] leading-[1.06] font-semibold">
              Платите за команду, а не за каждую запись
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              На старте оплату подтверждает менеджер — карта, Telegram Stars, крипта или счёт.
              Позже подключим автоматические платежи.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan, index) => (
              <Reveal key={plan.id} delay={index * 70}>
                <div
                  className={`flex h-full flex-col rounded-[28px] p-1.5 ring-1 ${
                    plan.highlighted
                      ? "bg-ink/10 ring-ink/10"
                      : "bg-white/60 ring-black/[0.05]"
                  }`}
                >
                  <div
                    className={`flex h-full flex-col rounded-[calc(28px-6px)] p-7 ${
                      plan.highlighted
                        ? "bg-ink text-white ring-1 ring-white/10"
                        : "bg-white ring-1 ring-black/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold">{plan.name}</p>
                      {plan.highlighted && (
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase">
                          Выбор салонов
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[12.5px] ${plan.highlighted ? "text-white/60" : "text-muted"}`}
                    >
                      {plan.tagline}
                    </p>
                    <div className="mt-7 flex items-end gap-1.5">
                      <span className="text-[28px] leading-none font-semibold tracking-tight">
                        {plan.priceUzs === 0 ? "0" : formatMoney(plan.priceUzs)}
                      </span>
                      <span
                        className={`pb-0.5 text-[12px] ${plan.highlighted ? "text-white/55" : "text-muted"}`}
                      >
                        {plan.period}
                      </span>
                    </div>
                    <ul className="mt-7 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[13px]">
                          <Check
                            size={15}
                            strokeWidth={1.8}
                            className={plan.highlighted ? "mt-0.5 text-brand" : "mt-0.5 text-mint"}
                          />
                          <span className={plan.highlighted ? "text-white/80" : "text-ink-soft"}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className={`btn mt-8 w-full ${
                        plan.highlighted ? "btn-accent" : "btn-ghost"
                      }`}
                    >
                      {plan.priceUzs === 0 ? "Начать бесплатно" : "Выбрать тариф"}
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="container-page pb-24 sm:pb-32">
          <Reveal>
            <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-white sm:px-16 sm:py-24">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(110,86,248,0.5),transparent_70%)]" />
              <div className="relative">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Sparkles size={22} strokeWidth={1.4} />
                </span>
                <h2 className="mx-auto mt-7 max-w-2xl text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.04] font-semibold">
                  Первая запись может быть уже завтра
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
                  Соберите страницу, отправьте ссылку в Instagram — и посмотрите, как записи
                  приходят сами.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link href="/register" className="btn group h-12 bg-white px-3 pl-6 text-ink">
                    Создать страницу
                    <span className="grid size-8 place-items-center rounded-full bg-ink/8 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-px">
                      <ArrowUpRight size={16} strokeWidth={1.6} />
                    </span>
                  </Link>
                  <Link href="/atelier-noir" className="btn btn-ghost h-12 border-white/20 text-white hover:bg-white/10">
                    Пример страницы
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="container-page pb-12">
        <div className="flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-[12px] text-muted">© {new Date().getFullYear()} uzbook.online</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-muted">
            <Link href="/login" className="hover:text-ink">
              Вход
            </Link>
            <a href="mailto:hello@uzbook.online" className="hover:text-ink">
              Поддержка
            </a>
            <span className="inline-flex items-center gap-1.5">
              <Scissors size={13} strokeWidth={1.6} /> Сделано для мастеров
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
