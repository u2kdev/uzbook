"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { loginAction, registerAction, type AuthState } from "@/app/(auth)/actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);

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

      <form action={formAction} className="mt-8 space-y-4">
        {mode === "register" && (
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
        )}

        <div>
          <label htmlFor="email" className="label-base">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@salon.uz"
            className="input-base"
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
            placeholder="Минимум 6 символов"
            className="input-base"
            minLength={6}
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
