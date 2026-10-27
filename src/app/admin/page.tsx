import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Inbox,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/server/auth/session";
import {
  getAdminBusinesses,
  getAdminOverview,
  getPendingRequests,
} from "@/server/business/admin";
import { RequestList } from "@/components/admin/request-list";
import { formatMoney, planById } from "@/lib/plans";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Активен",
  DRAFT: "Черновик",
  SUSPENDED: "Заблокирован",
};

export default async function AdminOverviewPage() {
  const session = await requireAdmin();
  const canManage = session.role === "ADMIN";
  const [stats, requests, businesses] = await Promise.all([
    getAdminOverview(),
    getPendingRequests(),
    getAdminBusinesses(),
  ]);

  const latest = businesses.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Пульт управления
          </p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-[-0.03em]">
            {session.role === "ADMIN" ? "Платформа uzbook" : "Поддержка uzbook"}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {stats.activeBusinesses} из {stats.businesses} бизнесов активны ·{" "}
            {stats.payingBusinesses} на платном тарифе
          </p>
        </div>
        <Link href="/admin/businesses" className="btn btn-ghost h-10 text-[12.5px]">
          Все бизнесы <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "MRR",
            value: formatMoney(stats.mrr),
            hint: `${stats.payingBusinesses} активных подписок`,
            icon: CircleDollarSign,
          },
          {
            label: "Бизнесы",
            value: String(stats.businesses),
            hint: `${stats.activeBusinesses} активны`,
            icon: Building2,
          },
          {
            label: "Пользователи",
            value: String(stats.users),
            hint: "владельцы и команда",
            icon: Users,
          },
          {
            label: "Записи за 30 дней",
            value: String(stats.bookings30d),
            hint: `${formatMoney(stats.bookingValue30d)} по прайсу`,
            icon: CalendarDays,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white p-4 ring-1 ring-line/80 transition-shadow duration-500 hover:shadow-soft"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] font-medium text-muted">{card.label}</p>
              <card.icon size={15} strokeWidth={1.5} className="text-muted/60" />
            </div>
            <p className="mt-2 truncate text-[24px] leading-none font-semibold tracking-[-0.03em]">
              {card.value}
            </p>
            <p className="mt-1.5 text-[11px] text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Inbox size={16} strokeWidth={1.6} className="text-muted" />
              <h2 className="text-[14px] font-semibold">Заявки на тариф</h2>
              {requests.length > 0 && (
                <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
                  {requests.length}
                </span>
              )}
            </div>
            <Link href="/admin/requests" className="text-[11.5px] font-medium text-brand-dark">
              Все заявки
            </Link>
          </div>
          <RequestList
            canManage={canManage}
            requests={requests.slice(0, 5).map((row) => ({
              id: row.subscription.id,
              plan: row.subscription.plan,
              businessName: row.businessName,
              businessSlug: row.businessSlug,
              ownerName: row.ownerName,
              ownerEmail: row.ownerEmail,
              amount: row.subscription.amount,
              currency: row.subscription.currency,
              createdAt: row.subscription.createdAt.toISOString(),
            }))}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} strokeWidth={1.6} className="text-muted" />
              <h2 className="text-[14px] font-semibold">Новые бизнесы</h2>
            </div>
            <Link href="/admin/businesses" className="text-[11.5px] font-medium text-brand-dark">
              Все
            </Link>
          </div>

          <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
            {latest.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-muted">Пока пусто</p>
            ) : (
              latest.map(({ business, ownerEmail, active }, index) => (
                <Link
                  key={business.id}
                  href={`/admin/businesses?q=${encodeURIComponent(business.slug)}`}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper/60 ${
                    index > 0 ? "border-t border-line/70" : ""
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-[12px] font-semibold text-ink-soft">
                    {business.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">{business.name}</p>
                    <p className="truncate text-[10.5px] text-muted">{ownerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold">{planById(business.plan).name}</p>
                    <p className="text-[10px] text-muted">
                      {active
                        ? `до ${new Intl.DateTimeFormat("ru-RU", {
                            day: "2-digit",
                            month: "short",
                          }).format(active.currentPeriodEnd ?? active.createdAt)}`
                        : STATUS_LABEL[business.status]}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
