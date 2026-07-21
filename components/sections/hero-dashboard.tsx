'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  TrendingUp,
  Users,
  Bell,
  Clock,
  CheckCircle2,
  Circle,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { cn } from '@/lib/utils';

const appointments = [
  { time: '09:00', name: 'Алиса Ю.', service: 'Стрижка', color: 'bg-primary' },
  { time: '10:30', name: 'Бекзод Р.', service: 'Маникюр', color: 'bg-success' },
  { time: '12:00', name: 'Дилфуза К.', service: 'Окрашивание', color: 'bg-amber-500' },
  { time: '14:00', name: 'Сардор Т.', service: 'Бритьё', color: 'bg-primary' },
  { time: '16:30', name: 'Нодира А.', service: 'Массаж', color: 'bg-success' },
];

const team = [
  { name: 'Малика', status: 'online', load: 82 },
  { name: 'Жасур', status: 'busy', load: 64 },
  { name: 'Камилла', status: 'online', load: 91 },
  { name: 'Рустам', status: 'offline', load: 0 },
];

const revenue = [38, 52, 44, 61, 73, 58, 82, 69, 91, 78, 95, 88];

export function HeroDashboard() {
  const { t } = useLang();
  const reduce = useReducedMotion();

  const float = (delay: number) =>
    reduce
      ? {}
      : {
          animate: { y: [0, -10, 0] },
          transition: { duration: 7, delay, repeat: Infinity, ease: 'easeInOut' as const },
        };

  return (
    <div className="relative w-full max-w-[560px] mx-auto">
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl rounded-full pointer-events-none" />

      {/* Main dashboard card */}
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="relative rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10 overflow-hidden"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Browser bar */}
        <div className="h-9 flex items-center gap-2 px-4 border-b border-border bg-muted/40">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 px-3 py-1 rounded-md bg-background border border-border text-[10px] text-muted-foreground font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            app.uzbook.online/dashboard
          </div>
        </div>

        {/* Body */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-14 border-r border-border bg-muted/30 py-3 items-center gap-1">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mb-2">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            {[
              <TrendingUp key="t" className="h-4 w-4" />,
              <Users key="u" className="h-4 w-4" />,
              <Bell key="b" className="h-4 w-4" />,
              <DollarSign key="d" className="h-4 w-4" />,
            ].map((icon, i) => (
              <div
                key={i}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground',
                  i === 0 && 'bg-primary/10 text-primary'
                )}
              >
                {icon}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3.5 space-y-3 bg-background">
            {/* Top row: greeting + date */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  {t.dashboard.today}, 17 июля
                </div>
                <div className="text-[13px] font-semibold text-foreground">
                  {t.dashboard.title}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary-hover" />
                <div className="h-7 w-7 rounded-full bg-muted border border-border -ml-3 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  +3
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label={t.dashboard.revenue}
                value="1 248k"
                delta="+12%"
                icon={<DollarSign className="h-3.5 w-3.5" />}
                {...float(0.4)}
              />
              <StatCard
                label={t.dashboard.newBookings}
                value="38"
                delta="+5"
                icon={<Calendar className="h-3.5 w-3.5" />}
                {...float(0.9)}
              />
              <StatCard
                label={t.dashboard.occupancy}
                value="84%"
                delta="+3%"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                {...float(1.4)}
              />
            </div>

            {/* Revenue chart */}
            <motion.div
              {...float(0.6)}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-foreground">
                  {t.dashboard.revenue}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-success font-medium">
                  <ArrowUpRight className="h-3 w-3" /> {t.dashboard.vsLastWeek}
                </div>
              </div>
              <div className="flex items-end gap-1 h-16">
                {revenue.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{
                      duration: 0.6,
                      delay: 0.6 + i * 0.05,
                      ease: 'easeOut',
                    }}
                    className={cn(
                      'flex-1 rounded-t-sm',
                      i === revenue.length - 2
                        ? 'bg-primary'
                        : 'bg-primary/25'
                    )}
                  />
                ))}
              </div>
            </motion.div>

            {/* Today appointments */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-foreground">
                  {t.dashboard.appointments}
                </div>
                <div className="text-[10px] text-muted-foreground">5 {t.dashboard.today.toLowerCase()}</div>
              </div>
              <div className="space-y-1.5">
                {appointments.slice(0, 4).map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="text-[10px] font-medium text-muted-foreground w-9 tabular-nums">
                      {a.time}
                    </div>
                    <div className={cn('h-6 w-1 rounded-full', a.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate">
                        {a.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {a.service}
                      </div>
                    </div>
                    {i < 2 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-border" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Team availability */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-semibold text-foreground mb-2">
                {t.dashboard.team}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {team.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 + i * 0.08 }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border" />
                      <div
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                          m.status === 'online' && 'bg-success',
                          m.status === 'busy' && 'bg-amber-500',
                          m.status === 'offline' && 'bg-muted-foreground/40'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-foreground truncate">
                        {m.name}
                      </div>
                      <div className="h-1 rounded-full bg-muted mt-0.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.load}%` }}
                          transition={{ delay: 1.2 + i * 0.1, duration: 0.6 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating notification card */}
      <motion.div
        initial={{ opacity: 0, x: 30, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        {...float(1.5)}
        className="absolute -right-4 sm:-right-10 top-24 sm:top-32 w-44 rounded-xl border border-border bg-card shadow-xl shadow-foreground/10 p-2.5 hidden sm:block"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-6 w-6 rounded-lg bg-success/10 flex items-center justify-center">
            <Bell className="h-3.5 w-3.5 text-success" />
          </div>
          <div className="text-[10px] font-semibold text-foreground">
            {t.dashboard.notifications}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground leading-snug">
          Новая запись: Сардор Т., 16:30 — Бритьё
        </div>
        <div className="text-[9px] text-muted-foreground/70 mt-1">только что</div>
      </motion.div>

      {/* Floating customer card */}
      <motion.div
        initial={{ opacity: 0, x: -30, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.3, duration: 0.6 }}
        {...float(2)}
        className="absolute -left-4 sm:-left-12 bottom-28 sm:bottom-32 w-48 rounded-xl border border-border bg-card shadow-xl shadow-foreground/10 p-2.5 hidden sm:block"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-semibold text-foreground">
            {t.dashboard.customers}
          </div>
          <Users className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          {[
            { n: 'Алиса Ю.', v: '12 визитов' },
            { n: 'Бекзод Р.', v: '5 визитов' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 border border-border" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-foreground truncate">
                  {c.n}
                </div>
                <div className="text-[9px] text-muted-foreground">{c.v}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating timeline pill */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        {...float(2.5)}
        className="absolute -right-2 sm:-right-8 -bottom-4 sm:-bottom-6 rounded-xl border border-border bg-card shadow-xl shadow-foreground/10 p-2.5 hidden sm:flex items-center gap-2"
      >
        <Clock className="h-3.5 w-3.5 text-primary" />
        <div className="text-[10px] font-medium text-foreground">
          {t.dashboard.timeline}
        </div>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  ...floatProps
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
} & any) {
  return (
    <motion.div
      {...floatProps}
      className="rounded-xl border border-border bg-card p-2.5"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="h-5 w-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="text-[9px] text-success font-medium">{delta}</div>
      </div>
      <div className="text-[13px] font-semibold text-foreground tabular-nums">
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground truncate">{label}</div>
    </motion.div>
  );
}
