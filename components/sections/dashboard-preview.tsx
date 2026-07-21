'use client';

import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Users,
  Clock,
  Settings,
  CreditCard,
  TrendingUp,
  Bell,
  Search,
  Plus,
} from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { SectionHeading } from '@/components/sections/section-heading';
import { cn } from '@/lib/utils';

const nav = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Calendar, label: 'Календарь' },
  { icon: Users, label: 'Клиенты' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Clock, label: 'Лента' },
  { icon: CreditCard, label: 'Платежи' },
  { icon: Settings, label: 'Настройки' },
];

const weekData = [
  { d: 'Пн', v: 62 },
  { d: 'Вт', v: 78 },
  { d: 'Ср', v: 54 },
  { d: 'Чт', v: 88 },
  { d: 'Пт', v: 95 },
  { d: 'Сб', v: 72 },
  { d: 'Вс', v: 38 },
];

const employees = [
  { name: 'Малика Х.', role: 'Топ-мастер', status: 'online', bookings: 8, color: 'bg-success' },
  { name: 'Жасур Р.', role: 'Барбер', status: 'busy', bookings: 6, color: 'bg-amber-500' },
  { name: 'Камилла А.', role: 'Стилист', status: 'online', bookings: 9, color: 'bg-success' },
  { name: 'Рустам Т.', role: 'Администратор', status: 'offline', bookings: 0, color: 'bg-muted-foreground/40' },
];

const customers = [
  { name: 'Алиса Юсупова', visits: 12, last: '2 дня назад', tag: 'VIP' },
  { name: 'Бекзод Рахимов', visits: 5, last: 'неделю назад', tag: '' },
  { name: 'Дилфуза Каримова', visits: 8, last: 'вчера', tag: 'VIP' },
];

export function DashboardPreview() {
  const { t } = useLang();

  return (
    <section id="dashboard" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t.dashboard.title}
          title="Один экран — полный контроль бизнеса"
          subtitle="Календарь, аналитика, CRM и статус сотрудников в реальном времени."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10 overflow-hidden"
        >
          {/* Browser chrome */}
          <div className="h-10 flex items-center gap-2 px-4 border-b border-border bg-muted/40">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/70" />
              <div className="h-3 w-3 rounded-full bg-amber-400/70" />
              <div className="h-3 w-3 rounded-full bg-green-400/70" />
            </div>
            <div className="mx-auto flex items-center gap-2 px-4 py-1 rounded-md bg-background border border-border text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              app.uzbook.online
            </div>
          </div>

          <div className="flex min-h-[520px]">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-56 border-r border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 px-2 py-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-semibold text-foreground">UzBook</div>
              </div>
              <div className="space-y-0.5">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                        item.active
                          ? 'bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/30'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto rounded-xl border border-border bg-card p-3">
                <div className="text-xs font-medium text-foreground mb-1">Pro тариф</div>
                <div className="text-[10px] text-muted-foreground mb-2">12 дней осталось</div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[60%] bg-primary rounded-full" />
                </div>
              </div>
            </div>

            {/* Main */}
            <div className="flex-1 p-4 sm:p-6 space-y-5 bg-background overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {t.dashboard.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.dashboard.today}, 17 июля 2026
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                    <Search className="h-3.5 w-3.5" />
                    Поиск...
                  </div>
                  <div className="relative h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t.dashboard.revenue, value: '4.8M сум', delta: '+12%', icon: TrendingUp },
                  { label: t.dashboard.newBookings, value: '142', delta: '+8%', icon: Calendar },
                  { label: t.dashboard.activeClients, value: '1 240', delta: '+5%', icon: Users },
                  { label: t.dashboard.occupancy, value: '84%', delta: '+3%', icon: BarChart3 },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-xl border border-border bg-card p-3.5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-success">{s.delta}</span>
                      </div>
                      <div className="text-xl font-semibold text-foreground tabular-nums">
                        {s.value}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Revenue chart */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t.dashboard.revenue} · неделя
                      </div>
                      <div className="text-xs text-muted-foreground">в тыс. сум</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-success font-medium">
                      <TrendingUp className="h-3.5 w-3.5" /> +18%
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-32">
                    {weekData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${d.v}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                          className={cn(
                            'w-full rounded-t-md',
                            d.v > 80 ? 'bg-primary' : 'bg-primary/30'
                          )}
                        />
                        <div className="text-[10px] text-muted-foreground">{d.d}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Employee status */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-sm font-semibold text-foreground mb-3">
                    {t.dashboard.team}
                  </div>
                  <div className="space-y-2.5">
                    {employees.map((e, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5"
                      >
                        <div className="relative">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border" />
                          <div className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card', e.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{e.name}</div>
                          <div className="text-[10px] text-muted-foreground">{e.role}</div>
                        </div>
                        <div className="text-xs font-semibold text-foreground tabular-nums">
                          {e.bookings}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom: calendar + customers */}
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Mini calendar */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-foreground">{t.dashboard.calendar}</div>
                    <div className="text-xs text-muted-foreground">Июль 2026</div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((d) => (
                      <div key={d} className="text-center text-[10px] text-muted-foreground py-1">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <div
                        key={d}
                        className={cn(
                          'text-center text-[11px] py-1.5 rounded-md transition-colors',
                          d === 17
                            ? 'bg-primary text-white font-semibold'
                            : [5, 12, 19, 26].includes(d)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customers */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-foreground">{t.dashboard.customers}</div>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    {customers.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 border border-border" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.visits} визитов · {c.last}
                          </div>
                        </div>
                        {c.tag && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            {c.tag}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
