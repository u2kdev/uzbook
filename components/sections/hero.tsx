'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/language-provider';
import { HeroDashboard } from './hero-dashboard';

export function Hero() {
  const { t } = useLang();

  return (
    <section id="top" className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-grid mask-fade-b opacity-[0.35]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-soft-blue/40 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left */}
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {t.hero.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.05] text-foreground text-balance"
            >
              {t.hero.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg"
            >
              {t.hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg" className="rounded-xl h-12 px-6 text-base shadow-lg shadow-primary/25 group">
                <a href="#pricing">
                  {t.hero.startFree}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl h-12 px-6 text-base bg-card/60 backdrop-blur">
                <a href="#preview">
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  {t.hero.watchDemo}
                </a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t.hero.noCard}
            </motion.div>

            {/* Inline stats */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 grid grid-cols-3 gap-6 max-w-md"
            >
              {[
                { v: '50K+', l: t.hero.stats.bookings },
                { v: '2K+', l: t.hero.stats.businesses },
                { v: '99.9%', l: t.hero.stats.uptime },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">
                    {s.v}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right - dashboard */}
          <div className="relative lg:pl-4">
            <HeroDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
