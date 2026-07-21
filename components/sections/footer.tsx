'use client';

import { Calendar, Twitter, Instagram, Send, Facebook } from 'lucide-react';
import { useLang } from '@/components/language-provider';

export function Footer() {
  const { t } = useLang();

  const columns = [
    {
      title: t.footer.product,
      links: [
        { label: t.footer.links.features, href: '#features' },
        { label: t.footer.links.pricing, href: '#pricing' },
        { label: t.footer.links.solutions, href: '#solutions' },
        { label: t.footer.links.demo, href: '#preview' },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { label: t.footer.links.about, href: '#' },
        { label: t.footer.links.blog, href: '#' },
        { label: t.footer.links.careers, href: '#' },
      ],
    },
    {
      title: t.footer.support,
      links: [
        { label: t.footer.links.help, href: '#' },
        { label: t.footer.links.contact, href: '#' },
        { label: t.footer.links.status, href: '#' },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.footer.links.privacy, href: '#' },
        { label: t.footer.links.terms, href: '#' },
        { label: t.footer.links.cookies, href: '#' },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14">
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <a href="#top" className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" strokeWidth={2.2} />
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-foreground">
                uzbook<span className="text-primary">.online</span>
              </span>
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {t.footer.tagline}
            </p>
            <div className="flex items-center gap-2">
              {[Telegram, Instagram, Send, Facebook].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                  aria-label="social"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold text-foreground mb-3">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            © 2026 uzbook.online · {t.footer.rights}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {t.hero.stats.uptime} 99.9%
          </div>
        </div>
      </div>
    </footer>
  );
}

function Telegram(props: any) {
  return <Send {...props} />;
}
