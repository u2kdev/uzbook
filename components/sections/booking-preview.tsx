'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors,
  Sparkles,
  Brush,
  User,
  Calendar,
  Check,
  ArrowRight,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { SectionHeading } from '@/components/sections/section-heading';
import { cn } from '@/lib/utils';

const services = [
  { id: 'haircut', name: { ru: 'Стрижка', uz: 'Soch olish' }, price: '50 000', icon: Scissors, duration: '30 мин' },
  { id: 'color', name: { ru: 'Окрашивание', uz: "Bo'yash" }, price: '180 000', icon: Brush, duration: '90 мин' },
  { id: 'spa', name: { ru: 'Спа-уход', uz: 'Spa-parvarish' }, price: '120 000', icon: Sparkles, duration: '60 мин' },
];

const specialists = [
  { id: 'malika', name: { ru: 'Малика', uz: 'Malika' }, role: { ru: 'Топ-мастер', uz: 'Top-usta' }, rating: '4.9' },
  { id: 'jasur', name: { ru: 'Жасур', uz: 'Jasur' }, role: { ru: 'Мастер', uz: 'Usta' }, rating: '4.8' },
];

const slots = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];

export function BookingPreview() {
  const { t, locale } = useLang();
  const [step, setStep] = useState(0);
  const [service, setService] = useState(0);
  const [specialist, setSpecialist] = useState(0);
  const [slot, setSlot] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => {
      setStep((s) => (s < 4 ? s + 1 : 0));
      if (step === 0) setService((s) => (s + 1) % services.length);
      if (step === 1) setSpecialist((s) => (s + 1) % specialists.length);
      if (step === 2) setSlot((s) => (s + 1) % slots.length);
    }, 2200);
    return () => clearInterval(cycle);
  }, [step]);

  const stepLabels = [
    t.preview.steps.service,
    t.preview.steps.specialist,
    t.preview.steps.datetime,
    t.preview.steps.confirm,
    t.preview.steps.success,
  ];

  return (
    <section id="preview" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-soft-blue/20 to-background" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t.preview.eyebrow}
          title={t.preview.title}
          subtitle={t.preview.subtitle}
        />

        <div className="mt-14 grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
          {/* Steps indicator */}
          <div className="space-y-3">
            {stepLabels.map((label, i) => {
              const active = i <= step;
              const current = i === step;
              return (
                <motion.div
                  key={i}
                  animate={{
                    opacity: active ? 1 : 0.45,
                    x: current ? 6 : 0,
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                    current
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-card'
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                      i < step
                        ? 'bg-success text-white'
                        : i === step
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                  {current && (
                    <motion.div
                      layoutId="stepActive"
                      className="ml-auto h-2 w-2 rounded-full bg-primary"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Phone-like booking widget */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-transparent blur-2xl rounded-3xl -z-10" />
            <div className="rounded-[28px] border border-border bg-card shadow-2xl shadow-foreground/10 overflow-hidden">
              {/* Widget header */}
              <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        UzBook
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.preview.selectService}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {step + 1}/4
                  </div>
                </div>
              </div>

              {/* Step content */}
              <div className="p-5 min-h-[320px]">
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div
                      key="service"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-2.5"
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {t.preview.selectService}
                      </div>
                      {services.map((s, i) => {
                        const Icon = s.icon;
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border p-3 transition-all',
                              i === service
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : 'border-border'
                            )}
                          >
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">
                                {s.name[locale]}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {s.duration}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-foreground tabular-nums">
                              {s.price}
                              <span className="text-[10px] text-muted-foreground ml-0.5">
                                сум
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {step === 1 && (
                    <motion.div
                      key="specialist"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-2.5"
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {t.preview.chooseSpecialist}
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {t.preview.any}
                          </div>
                        </div>
                      </div>
                      {specialists.map((sp, i) => (
                        <div
                          key={sp.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-3 transition-all',
                            i === specialist
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border'
                          )}
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 border border-border" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">
                              {sp.name[locale]}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {sp.role[locale]}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {sp.rating}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="datetime"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {t.preview.pickTime}
                      </div>
                      {/* Mini calendar */}
                      <div className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-foreground">
                            Июль 2026
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((d) => (
                            <div key={d} className="text-[9px] text-muted-foreground py-0.5">
                              {d}
                            </div>
                          ))}
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <div
                              key={d}
                              className={cn(
                                'text-[10px] py-1.5 rounded-md transition-colors',
                                d === 17
                                  ? 'bg-primary text-white font-semibold'
                                  : 'text-foreground hover:bg-muted'
                              )}
                            >
                              {d}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Slots */}
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((s, i) => (
                          <div
                            key={s}
                            className={cn(
                              'text-center text-xs font-medium py-2 rounded-lg border transition-all',
                              i === slot
                                ? 'border-primary bg-primary text-white'
                                : 'border-border text-foreground hover:border-primary/40'
                            )}
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-3"
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {t.preview.confirmBooking}
                      </div>
                      <div className="rounded-xl border border-border divide-y divide-border">
                        <Row label={t.preview.steps.service} value={services[service].name[locale]} />
                        <Row label={t.preview.steps.specialist} value={specialists[specialist].name[locale]} />
                        <Row label={t.preview.steps.datetime} value={`17 июля, ${slots[slot]}`} />
                        <Row label={t.dashboard.revenue} value={`${services[service].price} сум`} />
                      </div>
                      <motion.button
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-full rounded-xl bg-primary text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                      >
                        {t.preview.confirmBooking}
                        <ArrowRight className="h-4 w-4" />
                      </motion.button>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center text-center py-10"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4"
                      >
                        <CheckCircle2 className="h-9 w-9 text-success" />
                      </motion.div>
                      <div className="text-lg font-semibold text-foreground mb-1">
                        {t.preview.steps.success}!
                      </div>
                      <div className="text-sm text-muted-foreground max-w-[220px]">
                        {services[service].name[locale]} · 17 июля, {slots[slot]}
                      </div>
                      <div className="mt-5 text-xs text-primary font-medium">
                        {t.preview.bookAgain}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
