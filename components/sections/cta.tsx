'use client';

import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/language-provider';

export function CTA() {
  const { t } = useLang();

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-border bg-foreground px-6 py-16 sm:px-16 sm:py-20 text-center"
        >
          {/* Decorative grid */}
          <div className="absolute inset-0 opacity-[0.07] bg-grid" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/30 blur-[100px] rounded-full" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white text-balance max-w-2xl mx-auto">
              {t.cta.title}
            </h2>
            <p className="mt-4 text-base text-white/70 max-w-xl mx-auto">
              {t.cta.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-xl h-12 px-6 text-base bg-primary hover:bg-primary-hover shadow-xl shadow-primary/30 group">
                <a href="#">
                  {t.cta.button}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl h-12 px-6 text-base bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white">
                <a href="#">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {t.cta.secondary}
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
