"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2, Scissors, Sparkles, Stethoscope, Hand, Flower2, Store } from "lucide-react";
import { createBusinessAction, type OnboardingState } from "@/app/(auth)/actions";
import { slugify, suggestSlug } from "@/lib/slug";

const CATEGORIES = [
  { id: "beauty", label: "Салон красоты", icon: Sparkles },
  { id: "barbershop", label: "Барбершоп", icon: Scissors },
  { id: "dental", label: "Стоматология", icon: Stethoscope },
  { id: "nails", label: "Ногтевой сервис", icon: Hand },
  { id: "massage", label: "Массаж и спа", icon: Flower2 },
  { id: "other", label: "Другое", icon: Store },
];

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createBusinessAction,
    null,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState("beauty");

  const effectiveSlug = slugTouched ? slug : suggestSlug(name);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="name" className="label-base">
          Название
        </label>
        <input
          id="name"
          name="name"
          className="input-base h-12"
          placeholder="Atelier Noir"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="slug" className="label-base">
          Адрес страницы
        </label>
        <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
          <span className="pl-3.5 text-[13px] text-muted select-none">uzbook.online/</span>
          <input
            id="slug"
            name="slug"
            className="h-12 min-w-0 flex-1 bg-transparent pr-3.5 pl-0.5 text-[14px] outline-none"
            value={effectiveSlug}
            placeholder="atelier-noir"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
          />
        </div>
        {state?.fieldErrors?.slug ? (
          <p className="mt-1.5 text-[12px] text-rose">{state.fieldErrors.slug}</p>
        ) : (
          <p className="mt-1.5 text-[12px] text-muted">
            Латиница, цифры и дефис. Так клиент попадёт на вашу страницу.
          </p>
        )}
      </div>

      <div>
        <span className="label-base">Тип бизнеса</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-[12.5px] font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  active
                    ? "border-ink bg-ink text-white shadow-[0_10px_24px_-16px_rgba(11,11,16,0.9)]"
                    : "border-line bg-white text-ink-soft hover:border-ink/20"
                }`}
              >
                <item.icon size={16} strokeWidth={1.6} />
                {item.label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <div>
        <label htmlFor="city" className="label-base">
          Город <span className="font-normal normal-case text-muted">(необязательно)</span>
        </label>
        <input id="city" name="city" className="input-base" placeholder="Ташкент" />
      </div>

      {state?.error && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary group w-full h-12">
        {pending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            Создать страницу
            <ArrowRight
              size={16}
              strokeWidth={1.7}
              className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>
    </form>
  );
}
