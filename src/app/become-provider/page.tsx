"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Handshake,
  Loader2,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  submitProviderApplicationAction,
  type ProviderActionState,
} from "@/server/actions/providers";

export default function BecomeProviderPage() {
  const [state, formAction, pending] = useActionState<ProviderActionState, FormData>(
    submitProviderApplicationAction,
    null,
  );

  return (
    <div className="min-h-dvh bg-paper px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link href="/" className="btn btn-ghost h-9 px-3.5 text-[12.5px]">
            <ArrowLeft size={14} /> На главную
          </Link>
        </div>

        <div className="rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-9">
          <span className="badge">
            <Handshake size={13} /> Партнёрская программа · Роль Provider
          </span>

          <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[32px]">
            Стать официальным провайдером uzbook.online
          </h1>

          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Подключайте салоны красоты, барбершопы и частных мастеров к платформе, настраивайте
            для них индивидуальные условия подписки (количество сотрудников, лимит клиентов,
            14–30 дней бесплатно и персональную цену) и получайте партнёрское вознаграждение на
            личную карту.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-paper p-3.5">
              <Users size={18} className="text-brand" />
              <p className="mt-2 text-[12.5px] font-semibold">Гибкие тарифы</p>
              <p className="mt-0.5 text-[11px] text-muted">
                Сами задаёте число сотрудников, 14–30 дней триала и свою цену для клиента
              </p>
            </div>
            <div className="rounded-2xl bg-paper p-3.5">
              <CreditCard size={18} className="text-mint" />
              <p className="mt-2 text-[12.5px] font-semibold">Выплаты на карту</p>
              <p className="mt-0.5 text-[11px] text-muted">
                Базовая ставка 60% с каждой оплаты подключённого вами подписчика на вашу карту
              </p>
            </div>
            <div className="rounded-2xl bg-paper p-3.5">
              <ShieldCheck size={18} className="text-amber" />
              <p className="mt-2 text-[12.5px] font-semibold">Закрытый доступ</p>
              <p className="mt-0.5 text-[11px] text-muted">
                После проверки заявки владелец платформы выдаст вам личный никнейм и пароль
              </p>
            </div>
          </div>

          {state?.ok ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
              <h2 className="mt-3 text-[18px] font-semibold text-emerald-950">
                Заявка на роль Провайдера отправлена!
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-emerald-900/80">
                {state.message}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/" className="btn btn-primary h-10 px-5 text-[12.5px]">
                  Вернуться на главную
                </Link>
                <Link href="/login" className="btn btn-ghost h-10 px-5 text-[12.5px]">
                  Страница входа
                </Link>
              </div>
            </div>
          ) : (
            <form action={formAction} className="mt-7 space-y-4 border-t border-line pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-base">Ваше имя и фамилия *</label>
                  <input
                    name="fullName"
                    type="text"
                    required
                    placeholder="Рустам Алимов"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Телефон для связи *</label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="+998 90 123 45 67"
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label-base">Telegram (@username)</label>
                  <input
                    name="telegram"
                    type="text"
                    placeholder="@rustam_partner"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Email</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="partner@mail.uz"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-base">Город / Регион</label>
                  <input
                    name="city"
                    type="text"
                    placeholder="Ташкент"
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="label-base">
                  Номер личной карты (Uzcard / Humo / Visa) для выплат
                </label>
                <input
                  name="payoutCard"
                  type="text"
                  placeholder="8600 •••• •••• •••• (можно указать позже)"
                  className="input-base"
                />
              </div>

              <div>
                <label className="label-base">Опыт и комментарий к заявке</label>
                <textarea
                  name="experienceNote"
                  rows={3}
                  placeholder="Расскажите коротко о себе: с какими салонами или мастерами работаете и сколько клиентов планируете подключать"
                  className="input-base h-auto resize-y py-3"
                />
              </div>

              {state?.error && (
                <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
                  {state.error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary h-12 w-full gap-2 text-[14px]"
              >
                {pending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Send size={15} /> Отправить спец-заявку на Провайдера
                  </>
                )}
              </button>

              <p className="text-center text-[11.5px] text-muted">
                Уже получили никнейм и пароль от администратора?{" "}
                <Link href="/login" className="font-semibold text-ink underline">
                  Войти в кабинет провайдера
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
