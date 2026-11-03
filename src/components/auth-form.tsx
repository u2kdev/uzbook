"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Loader2, Sparkles, Scissors, Headphones } from "lucide-react";
import { loginAction, registerAction, type AuthState } from "@/app/(auth)/actions";

const DEMO_ACCOUNTS = [
  {
    role: "Владелец салона (PRO)",
    name: "Салон Atelier Noir · Полный дашборд",
    email: "owner@uzbook.online",
    password: "owner1234",
    icon: Sparkles,
    badge: "PRO",
  },
  {
    role: "Барбершоп (TRIAL)",
    name: "Barber House · Записи и таймлайн",
    email: "barber@uzbook.online",
    password: "barber1234",
    icon: Scissors,
    badge: "TRIAL",
  },
  {
    role: "Поддержка",
    name: "Служба поддержки · Просмотр",
    email: "support@uzbook.online",
    password: "support1234",
    icon: Headphones,
    badge: "SUPPORT",
  },
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  const fillCredentials = (email: string, pass: string) => {
    setEmailValue(email);
    setPasswordValue(pass);
  };

  return (
    <div>
      <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em]">
        {mode === "login" ? "С возвращением" : "Создайте страницу салона"}
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
        {mode === "login"
          ? "Войдите, чтобы открыть таймлайн и записи."
          : "14 дней бесплатно. Без карты, без установки."}
      </p>

      {mode === "login" && (
        <div className="mt-6 rounded-2xl border border-line bg-paper/60 p-3.5">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
            Быстрый вход для тестирования (в 1 клик):
          </p>
          <div className="mt-2.5 space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillCredentials(acc.email, acc.password)}
                  className="flex w-full items-center justify-between rounded-xl border border-line/80 bg-white px-3 py-2 text-left transition hover:border-brand/40 hover:bg-brand-soft/20"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-paper text-ink ring-1 ring-line">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-ink leading-tight">
                        {acc.role}
                      </p>
                      <p className="truncate text-[11px] text-muted leading-tight mt-0.5">
                        {acc.email} · Пароль: <span className="font-mono text-ink">{acc.password}</span>
                      </p>
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-[9.5px] font-bold text-muted ring-1 ring-line uppercase">
                    {acc.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label htmlFor="name" className="label-base">
                Ваше имя
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Мадина Каримова"
                className="input-base"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="label-base">
                Номер телефона
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+998 90 123 45 67"
                className="input-base"
                required
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="email" className="label-base">
            {mode === "login"
              ? "Телефон, Email или никнейм"
              : "Email"}
          </label>
          <input
            id="email"
            name="email"
            type={mode === "login" ? "text" : "email"}
            autoComplete={mode === "login" ? "username" : "email"}
            placeholder={
              mode === "login"
                ? "+998 90 123 45 67, email или никнейм"
                : "you@salon.uz"
            }
            className="input-base"
            value={mode === "login" ? emailValue : undefined}
            onChange={mode === "login" ? (e) => setEmailValue(e.target.value) : undefined}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label-base">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Минимум 6 символов" : "Минимум 8 символов"}
            className="input-base"
            value={mode === "login" ? passwordValue : undefined}
            onChange={mode === "login" ? (e) => setPasswordValue(e.target.value) : undefined}
            minLength={mode === "login" ? 6 : 8}
            maxLength={128}
            required
          />
        </div>

        {state?.error && (
          <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
            {state.error}
          </div>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary group mt-2 w-full">
          {pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              {mode === "login" ? "Войти" : "Создать аккаунт"}
              <ArrowRight
                size={16}
                strokeWidth={1.7}
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-muted">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link href="/register" className="font-semibold text-ink underline underline-offset-4">
              Создать страницу
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
              Войти
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
