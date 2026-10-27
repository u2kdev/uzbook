import { Inbox } from "lucide-react";
import { requireAdmin } from "@/server/auth/session";
import {
  getAdminSubscriptionHistory,
  getPendingRequests,
} from "@/server/business/admin";
import { RequestList } from "@/components/admin/request-list";
import { formatMoney, planById } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки" };

const SUB_STATUS: Record<string, { label: string; className: string }> = {
  TRIAL: { label: "Пробный", className: "bg-paper text-muted" },
  PENDING: { label: "Заявка", className: "bg-amber/10 text-amber" },
  ACTIVE: { label: "Активен", className: "bg-mint/10 text-mint" },
  PAST_DUE: { label: "Просрочен", className: "bg-rose/10 text-rose" },
  CANCELLED: { label: "Отменён", className: "bg-paper text-muted" },
};

export default async function AdminRequestsPage() {
  const session = await requireAdmin();
  const [requests, history] = await Promise.all([
    getPendingRequests(),
    getAdminSubscriptionHistory(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Оплаты
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Заявки на тариф
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          {requests.length} ждут подтверждения. После подтверждения тариф включается на 30 дней.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Inbox size={16} strokeWidth={1.6} className="text-muted" />
          <h2 className="text-[14px] font-semibold">Ожидают</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
              {requests.length}
            </span>
          )}
        </div>

        <RequestList
          canManage={session.role === "ADMIN"}
          requests={requests.map((row) => ({
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
        <h2 className="px-1 text-[14px] font-semibold">История</h2>
        <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted">Пока нет записей</p>
          ) : (
            history.map(({ subscription, businessName, businessSlug, ownerEmail }, index) => {
              const status = SUB_STATUS[subscription.status] ?? {
                label: subscription.status,
                className: "bg-paper text-muted",
              };
              return (
                <div
                  key={subscription.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                    index > 0 ? "border-t border-line/70" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">
                      {businessName}
                      <span className="ml-1.5 text-[10.5px] font-normal text-muted">
                        /{businessSlug}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted">
                      {ownerEmail} ·{" "}
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(subscription.createdAt)}
                    </p>
                  </div>
                  <span className="text-[11.5px] font-medium">{planById(subscription.plan).name}</span>
                  <span className="w-20 text-right text-[11.5px] font-medium tabular-nums">
                    {subscription.amount > 0
                      ? formatMoney(subscription.amount, subscription.currency)
                      : "—"}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
