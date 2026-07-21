'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Menu, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/language-provider';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { t, locale, setLocale } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#features', label: t.nav.features },
    { href: '#solutions', label: t.nav.solutions },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#faq', label: t.nav.faq },
  ];

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className={cn(
          'transition-all duration-300',
          scrolled ? 'glass border-b border-border/60' : 'bg-transparent'
        )}
      >
        <nav className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#top" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30 transition-transform group-hover:scale-105">
              <Calendar className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-foreground">
              uzbook<span className="text-primary">.online</span>
            </span>
          </a>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/60"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setLangOpen((v) => !v)}
                onBlur={() => setTimeout(() => setLangOpen(false), 120)}
                className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span className="uppercase">{locale}</span>
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-32 rounded-xl border border-border bg-popover shadow-lg shadow-foreground/5 p-1"
                  >
                    {(['ru', 'uz'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          setLocale(l);
                          setLangOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          locale === l
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        {l === 'ru' ? 'Русский' : 'O‘zbekcha'}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <a
              href="#"
              className="hidden sm:inline-flex items-center h-9 px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.nav.login}
            </a>

            <Button asChild size="sm" className="hidden sm:inline-flex rounded-lg h-9 px-4 shadow-sm shadow-primary/25">
              <a href="#pricing">{t.nav.startFree}</a>
            </Button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-foreground hover:bg-muted transition-colors"
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden glass border-b border-border overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <div className="flex items-center gap-2 px-3 py-2">
                {(['ru', 'uz'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium uppercase transition-colors',
                      locale === l
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <Button asChild className="mt-2 rounded-lg">
                <a href="#pricing" onClick={() => setOpen(false)}>
                  {t.nav.startFree}
                </a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
