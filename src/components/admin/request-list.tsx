"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import {
  approveSubscriptionAction,
  declineSubscriptionAction,
} from "@/server/actions/admin";
import { formatMoney, planById, type PlanId } from "@/lib/plans";

export type RequestRow = {
  id: string;
  plan: PlanId;
  businessName: string;
  businessSlug: string;
  ownerName: string;
  ownerEmail: string;
  amount: number;
  currency: string;
  createdAt: string;
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
      {requests.map((request, index) => (
        <div
          key={request.id}
          className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
            index > 0 ? "border-t border-line/70" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">
              {request.businessName}
              <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[9.5px] font-semibold text-brand-dark">
                {planById(request.plan).name}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {request.ownerName} · {request.ownerEmail} ·{" "}
              {new Intl.DateTimeFormat("ru-RU", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(request.createdAt))}
            </p>
          </div>

          <p className="text-[12px] font-semibold tabular-nums">
            {formatMoney(request.amount, request.currency)}
          </p>

          <Link
            href={`/${request.businessSlug}`}
            target="_blank"
            className="text-[11px] font-medium text-muted underline underline-offset-4 hover:text-ink"
          >
            страница
          </Link>

          {canManage ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => decline(request.id)}
                disabled={pending}
                className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-rose/5 hover:text-rose"
                title="Отклонить"
              >
                <X size={14} />
              </button>
              <button
                onClick={() => approve(request.id)}
                disabled={pending}
                className="btn btn-primary h-8 px-3 text-[11px]"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Подтвердить
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-paper px-2 py-1 text-[10px] text-muted">
              только просмотр
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
