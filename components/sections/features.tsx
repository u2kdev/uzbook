'use client';

import { motion } from 'framer-motion';
import {
  CalendarClock,
  Users,
  CalendarDays,
  BarChart3,
  CreditCard,
  BellRing,
} from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { SectionHeading } from '@/components/sections/section-heading';

const icons = {
  booking: CalendarClock,
  crm: Users,
  scheduling: CalendarDays,
  analytics: BarChart3,
  payments: CreditCard,
  notifications: BellRing,
};

export function Features() {
  const { t } = useLang();
  const keys = Object.keys(t.features.items) as (keyof typeof t.features.items)[];

  return (
    <section id="features" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t.features.eyebrow}
          title={t.features.title}
          subtitle={t.features.subtitle}
        />

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {keys.map((key, i) => {
            const item = t.features.items[key];
            const Icon = icons[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group relative rounded-[20px] border border-border bg-card p-6 hover:shadow-xl hover:shadow-foreground/[0.06] hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="h-11 w-11 rounded-xl border border-border bg-gradient-to-b from-background to-muted/40 flex items-center justify-center mb-4 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
                <div className="absolute inset-0 rounded-[20px] ring-1 ring-inset ring-primary/0 group-hover:ring-primary/10 transition-all pointer-events-none" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
