'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  Scissors,
  Stethoscope,
  Dumbbell,
  Car,
  Waves,
  Flower2,
  PawPrint,
  GraduationCap,
  Briefcase,
  Smile,
} from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { SectionHeading } from '@/components/sections/section-heading';

const categoryIcons = {
  beauty: Sparkles,
  barber: Scissors,
  medical: Stethoscope,
  dental: Smile,
  fitness: Dumbbell,
  auto: Car,
  carwash: Waves,
  spa: Flower2,
  tattoo: Scissors,
  vet: PawPrint,
  education: GraduationCap,
  consulting: Briefcase,
};

export function Categories() {
  const { t } = useLang();
  const keys = Object.keys(t.categories.items) as (keyof typeof t.categories.items)[];

  return (
    <section id="solutions" className="py-20 sm:py-28 relative bg-slate-bg/50">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t.categories.eyebrow}
          title={t.categories.title}
          subtitle={t.categories.subtitle}
        />

        <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {keys.map((key, i) => {
            const Icon = categoryIcons[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.06 }}
                whileHover={{ y: -3 }}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-foreground/[0.05] transition-all cursor-pointer"
              >
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-b from-muted/60 to-muted/20 border border-border flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.75} />
                </div>
                <span className="text-sm font-medium text-foreground text-center">
                  {t.categories.items[key]}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
