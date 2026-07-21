'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { useLang } from '@/components/language-provider';

function Counter({ to, suffix, decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  const formatted = val.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

export function Stats() {
  const { t } = useLang();
  const items = [
    { value: 50000, suffix: '+', label: t.stats.bookings },
    { value: 2000, suffix: '+', label: t.stats.businesses },
    { value: 150000, suffix: '+', label: t.stats.customers },
    { value: 99.9, suffix: '%', label: t.stats.uptime, decimals: 1 },
  ];

  return (
    <section className="py-16 sm:py-20 border-y border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
                <Counter to={s.value} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
