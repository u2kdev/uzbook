"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import {
  BILLING_PERIODS,
  calculatePlanPrice,
  formatMoney,
  PLANS,
  type BillingPeriodMonths,
  type Plan,
} from "@/lib/plans";
import { GradientHeading } from "@/components/ui/gradient-heading";

export function PricingSection() {
  const [selectedMonths, setSelectedMonths] = useState<BillingPeriodMonths>(1);

  return (
    <section id="pricing" className="container-page py-24 sm:py-32">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <GradientHeading variant="secondary">
            Прозрачные тарифы
          </GradientHeading>
        </div>
        <GradientHeading size="lg" as="h2" className="text-ink">
          Платите за команду, а не за каждую запись
        </GradientHeading>
        <p className="mx-auto max-w-lg text-[15px] leading-relaxed text-muted">
          14 дней бесплатного доступа без привязки карты. Выбирайте период на 1, 3, 6 или 12
          месяцев с выгодой до 25%.
        </p>

        {/* Period Switcher Tabs */}
        <div className="pt-6 flex justify-center">
          <div className="relative inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-line/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-md">
            {BILLING_PERIODS.map((period) => {
              const isSelected = selectedMonths === period.months;
              return (
                <button
                  key={period.months}
                  type="button"
                  onClick={() => setSelectedMonths(period.months)}
                  className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                    isSelected ? "text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="pricing-period-active-pill"
                      className="absolute inset-0 rounded-full bg-ink shadow-sm"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{period.label}</span>
                  {period.badge && (
                    <span
                      className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight ${
                        isSelected
                          ? "bg-brand text-white"
                          : "bg-brand-soft text-brand"
                      }`}
                    >
                      {period.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan: Plan, index: number) => {
          const isTrial = plan.id === "TRIAL";
          const calculation = isTrial
            ? null
            : calculatePlanPrice({
                baseMonthlyPrice: plan.priceUzs,
                months: selectedMonths,
              });

          const isHighlighted = !!plan.highlighted;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: index * 0.08,
                duration: 0.5,
                ease: "easeOut",
              }}
              className={`relative flex h-full flex-col rounded-[30px] p-2 transition-all duration-300 ${
                isHighlighted
                  ? "bg-gradient-to-b from-brand/25 via-ink/15 to-transparent shadow-[0_20px_50px_-20px_rgba(110,86,248,0.3)] ring-1 ring-brand/30"
                  : "bg-white/60 ring-1 ring-black/[0.06] hover:shadow-soft"
              }`}
            >
              <div
                className={`flex h-full flex-col rounded-[calc(30px-8px)] p-7 ${
                  isHighlighted
                    ? "bg-ink text-white ring-1 ring-white/10"
                    : "bg-white text-ink ring-1 ring-black/[0.03]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-bold">{plan.name}</h3>
                  {isHighlighted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-bold tracking-wider text-brand-light uppercase">
                      <Sparkles size={11} /> Выбор салонов
                    </span>
                  )}
                </div>

                <p
                  className={`mt-1.5 min-h-[38px] text-[12.5px] leading-snug ${
                    isHighlighted ? "text-white/65" : "text-muted"
                  }`}
                >
                  {plan.tagline}
                </p>

                {/* Price Display */}
                <div className="mt-6 border-t border-line/20 pt-6">
                  {isTrial ? (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[34px] leading-none font-extrabold tracking-tight">
                          0
                        </span>
                        <span className="text-[13px] text-muted">UZS</span>
                      </div>
                      <p className="mt-1 text-[12px] text-muted font-medium">
                        14 дней полного доступа
                      </p>
                    </div>
                  ) : calculation ? (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[34px] leading-none font-extrabold tracking-tight">
                          {formatMoney(calculation.pricePerMonthUzs)}
                        </span>
                        <span
                          className={`text-[12px] ${
                            isHighlighted ? "text-white/60" : "text-muted"
                          }`}
                        >
                          / месяц
                        </span>
                      </div>

                      {calculation.discountPercent > 0 ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[12px] line-through ${
                              isHighlighted ? "text-white/45" : "text-muted"
                            }`}
                          >
                            {formatMoney(calculation.rawTotal)}
                          </span>
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                            Экономия {formatMoney(calculation.savingsUzs)}
                          </span>
                        </div>
                      ) : (
                        <p
                          className={`mt-1 text-[12px] ${
                            isHighlighted ? "text-white/55" : "text-muted"
                          }`}
                        >
                          Оплата помесячно
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Features List */}
                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px]">
                      <span
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
                          isHighlighted
                            ? "bg-brand text-white"
                            : "bg-brand-soft text-brand"
                        }`}
                      >
                        <Check size={11} strokeWidth={2.4} />
                      </span>
                      <span className={isHighlighted ? "text-white/85" : "text-ink-soft"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Action CTA Button */}
                <div className="mt-8">
                  <Link
                    href={`/register?plan=${plan.id}&period=${selectedMonths}`}
                    className={`btn group w-full h-11 text-[13.5px] font-semibold transition-all duration-300 ${
                      isHighlighted
                        ? "bg-brand text-white hover:bg-brand-dark hover:shadow-[0_10px_24px_-10px_rgba(110,86,248,0.7)]"
                        : isTrial
                        ? "bg-ink text-white hover:bg-[#1d1d27]"
                        : "border border-line bg-paper text-ink hover:bg-white hover:border-brand/40"
                    }`}
                  >
                    <span>{isTrial ? "Начать бесплатно" : "Выбрать тариф"}</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
