'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/language-provider';
import { SectionHeading } from '@/components/sections/section-heading';
import { cn } from '@/lib/utils';

export function Pricing() {
  const { t } = useLang();
  const plans = [
    { key: 'starter', ...t.pricing.starter, price: '0', highlight: false },
    { key: 'business', ...t.pricing.business, price: '99 000', highlight: true },
    { key: 'enterprise', ...t.pricing.enterprise, price: 'Custom', highlight: false },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t.pricing.eyebrow}
          title={t.pricing.title}
          subtitle={t.pricing.subtitle}
        />

        <div className="mt-14 grid lg:grid-cols-3 gap-5 lg:gap-4 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={cn(
                'relative rounded-[20px] border p-6 sm:p-7',
                plan.highlight
                  ? 'border-primary bg-card shadow-2xl shadow-primary/10 lg:-mt-4 lg:mb-4'
                  : 'border-border bg-card'
              )}
            >
              {plan.highlight && (
                <>
                  <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-primary/30">
                      {t.pricing.mostPopular}
                    </span>
                  </div>
                </>
              )}

              <div className="relative">
                <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">{plan.desc}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  {plan.price === 'Custom' ? (
                    <span className="text-3xl font-semibold text-foreground">По запросу</span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                        {plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">сум{t.pricing.perMonth}</span>
                    </>
                  )}
                </div>

                <Button
                  asChild
                  className={cn(
                    'mt-6 w-full rounded-xl h-11',
                    plan.highlight
                      ? 'shadow-lg shadow-primary/25'
                      : 'bg-foreground text-background hover:bg-foreground/90'
                  )}
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  <a href="#">
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>

                <div className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0',
                          plan.highlight ? 'bg-primary' : 'bg-foreground/10'
                        )}
                      >
                        <Check
                          className={cn(
                            'h-2.5 w-2.5',
                            plan.highlight ? 'text-white' : 'text-foreground'
                          )}
                          strokeWidth={3}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
