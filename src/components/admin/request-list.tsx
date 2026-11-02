"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Check, CreditCard, ExternalLink, Hash, Loader2, Phone, Users, X } from "lucide-react";
import {
  approveSubscriptionAction,
  declineSubscriptionAction,
} from "@/server/actions/admin";
import { formatMoney, planById, type PlanId } from "@/lib/plans";

export type RequestRow = {
  id: string;
  businessId?: string;
  plan: PlanId;
  provider?: string;
  note?: string | null;
  businessName: string;
  businessSlug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  contactPhone?: string | null;
  amount: number;
  currency: string;
  createdAt: string;
  providerName?: string | null;
  providerPayoutCard?: string | null;
  providerCommissionPercent?: number | null;
  providerPayoutAmount?: number | null;
};

export function RequestList({
  requests,
  canManage,
}: {
  requests: RequestRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function approve(id: string) {
    startTransition(async () => {
      await approveSubscriptionAction(id);
      router.refresh();
    });
  }

  function decline(id: string) {
    startTransition(async () => {
      await declineSubscriptionAction(id);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-line bg-white/60 px-5 py-10 text-center">
        <p className="text-[13px] font-semibold">Нет новых заявок</p>
        <p className="mt-1 text-[11.5px] text-muted">
          Когда владелец выберет тариф, заявка появится здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line/80">
      {requests.map((request, index) => {
        const phone = request.contactPhone || request.ownerPhone;
        const formattedDate = new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(request.createdAt));

        return (
          <div
            key={request.id}
            className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
              index > 0 ? "border-t border-line/70" : ""
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[14px] text-ink">{request.businessName}</span>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                  {planById(request.plan).name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-0.5 font-mono text-[10px] text-muted">
                  <Hash size={10} /> ID: {request.id.slice(0, 8)}
                </span>
                <Link
                  href={`/${request.businessSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink"
                >
                  <ExternalLink size={11} />
                  /{request.businessSlug}
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                <span>Владелец: <b className="font-medium text-ink-soft">{request.ownerName}</b> ({request.ownerEmail})</span>
                {phone && (
                  <span className="inline-flex items-center gap-1 text-ink-soft">
                    <Phone size={12} className="text-muted" />
                    Телефон для связи:{" "}
                    <a
                      href={`tel:${phone}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {phone}
                    </a>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} className="text-muted" />
                  Отправлена: {formattedDate}
                </span>
              </div>

              {request.note && (
                <p className="rounded-lg bg-paper/80 px-2.5 py-1 font-mono text-[11px] text-ink-soft">
                  {request.note}
                </p>
              )}

              {request.providerName && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-mint/10 px-2.5 py-1 text-[11px] font-medium text-mint">
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} />
                    Провайдер: <b>{request.providerName}</b>
                  </span>
                  {request.providerPayoutAmount ? (
                    <span>
                      · Выплата ({request.providerCommissionPercent ?? 60}%):{" "}
                      <b>{formatMoney(request.providerPayoutAmount, request.currency)}</b>
                    </span>
                  ) : null}
                  {request.providerPayoutCard ? (
                    <span className="inline-flex items-center gap-1 font-mono text-ink">
                      <CreditCard size={12} />
                      {request.providerPayoutCard}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-[14px] font-bold tabular-nums text-ink">
                {formatMoney(request.amount, request.currency)}
              </span>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decline(request.id)}
                    disabled={pending}
                    className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-rose/5 hover:text-rose disabled:opacity-50"
                    title="Отклонить"
                  >
                    <X size={15} />
                  </button>
                  <button
                    onClick={() => approve(request.id)}
                    disabled={pending}
                    className="btn btn-primary h-8 gap-1.5 px-3 text-[11.5px]"
                  >
                    {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Подтвердить
                  </button>
                </div>
              ) : (
                <span className="rounded-full bg-paper px-2.5 py-1 text-[10.5px] text-muted">
                  Только просмотр
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
