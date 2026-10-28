"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  exportClientsCsvAction,
  getClientDetailedInfoAction,
  saveClientAction,
  updateClientNotesAction,
  type ClientDetailedInfo,
  type ClientSummary,
} from "@/server/actions/clients";
import { createManualBookingAction } from "@/server/actions/bookings";
import { formatMoney } from "@/lib/plans";

type ServiceOption = { id: string; name: string; durationMin: number; price: number };
type StaffOption = { id: string; name: string; color: string; title: string | null };

const SEGMENT_BADGES: Record<
  ClientSummary["segment"],
  { label: string; bg: string; text: string; border: string }
> = {
  vip: {
    label: "VIP",
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    border: "border-amber-500/30",
  },
  regular: {
    label: "Постоянный",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    border: "border-emerald-500/30",
  },
  new: {
    label: "Новый",
    bg: "bg-sky-500/10",
    text: "text-sky-700",
    border: "border-sky-500/30",
  },
  sleeping: {
    label: "Спящий",
    bg: "bg-zinc-500/10",
    text: "text-zinc-600",
    border: "border-zinc-500/30",
  },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Ожидает", cls: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Подтверждена", cls: "bg-indigo-100 text-indigo-800" },
  COMPLETED: { label: "Завершена", cls: "bg-emerald-100 text-emerald-800" },
  NO_SHOW: { label: "Не пришёл", cls: "bg-rose-100 text-rose-800" },
  CANCELLED: { label: "Отменена", cls: "bg-zinc-100 text-zinc-600" },
};

export function ClientsManager({
  initialClients,
  stats,
  currency,
  services,
  staff,
  timezone,
  today,
}: {
  initialClients: ClientSummary[];
  stats: {
    totalClients: number;
    vipClients: number;
    totalRevenue: number;
    avgLtv: number;
  };
  currency: string;
  services: ServiceOption[];
  staff: StaffOption[];
  timezone: string;
  today: string;
}) {
  const router = useRouter();
  const [clientsList, setClientsList] = useState<ClientSummary[]>(initialClients);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | ClientSummary["segment"]>("all");
  const [sortBy, setSortBy] = useState<"recent" | "spent" | "visits" | "name">("recent");

  // Selected client for detail drawer
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetailedInfo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Quick repeat booking dialog state
  const [repeatModalOpen, setRepeatModalOpen] = useState(false);
  const [repeatClient, setRepeatClient] = useState<ClientSummary | null>(null);
  const [repeatServiceId, setRepeatServiceId] = useState("");
  const [repeatStaffId, setRepeatStaffId] = useState("");
  const [repeatDate, setRepeatDate] = useState(today);
  const [repeatTime, setRepeatTime] = useState("10:00");
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [repeatPending, setRepeatPending] = useState(false);

  // New client modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);

  // Export CSV state
  const [exporting, setExporting] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    let result = clientsList;

    if (segmentFilter !== "all") {
      result = result.filter((c) => c.segment === segmentFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const digits = q.replace(/\D/g, "");
      result = result.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = digits && c.phone.replace(/\D/g, "").includes(digits);
        const serviceMatch = c.favoriteServiceName?.toLowerCase().includes(q);
        const notesMatch = c.notes?.toLowerCase().includes(q);
        return nameMatch || phoneMatch || serviceMatch || notesMatch;
      });
    }

    const sorted = [...result];
    if (sortBy === "recent") {
      sorted.sort((a, b) => {
        const dA = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
        const dB = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
        return dB - dA;
      });
    } else if (sortBy === "spent") {
      sorted.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === "visits") {
      sorted.sort((a, b) => b.completedVisits - a.completedVisits);
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    return sorted;
  }, [clientsList, search, segmentFilter, sortBy]);

  // Open client detail drawer
  async function handleOpenDetail(phone: string) {
    setSelectedPhone(phone);
    setLoadingDetail(true);
    setEditingNotes(false);
    try {
      const detail = await getClientDetailedInfoAction(phone);
      setClientDetail(detail);
      setNotesText(detail?.notes ?? "");
    } catch {
      setClientDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Save notes handler
  async function handleSaveNotes() {
    if (!selectedPhone) return;
    setSavingNotes(true);
    try {
      const res = await updateClientNotesAction(selectedPhone, notesText);
      if (res.ok) {
        setEditingNotes(false);
        if (clientDetail) {
          setClientDetail({ ...clientDetail, notes: notesText.trim() || null });
        }
        setClientsList((prev) =>
          prev.map((c) => (c.phone === selectedPhone ? { ...c, notes: notesText.trim() || null } : c)),
        );
      }
    } finally {
      setSavingNotes(false);
    }
  }

  // Open quick repeat booking modal
  function handleOpenRepeatBooking(client: ClientSummary) {
    setRepeatClient(client);
    setRepeatServiceId(client.favoriteServiceId || (services[0]?.id ?? ""));
    setRepeatStaffId(client.favoriteStaffId || (staff[0]?.id ?? ""));
    setRepeatDate(today);
    setRepeatTime("10:00");
    setRepeatError(null);
    setRepeatModalOpen(true);
  }

  // Submit quick repeat booking
  async function handleRepeatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repeatClient) return;

    setRepeatPending(true);
    setRepeatError(null);

    const formData = new FormData();
    formData.append("name", repeatClient.name);
    formData.append("phone", repeatClient.phone);
    if (repeatClient.email) formData.append("email", repeatClient.email);
    formData.append("serviceId", repeatServiceId);
    formData.append("staffId", repeatStaffId);
    formData.append("startAt", `${repeatDate}T${repeatTime}:00`);
    formData.append("note", "Повторная запись из базы клиентов");

    try {
      const res = await createManualBookingAction({}, formData);
      if (res?.error) {
        setRepeatError(res.error);
      } else {
        setRepeatModalOpen(false);
        router.refresh();
        if (selectedPhone) {
          void handleOpenDetail(selectedPhone);
        }
      }
    } catch (err: unknown) {
      setRepeatError(err instanceof Error ? err.message : "Не удалось записать");
    } finally {
      setRepeatPending(false);
    }
  }

  // Handle Export CSV
  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await exportClientsCsvAction();
      if (res.ok && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename || "clients.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || "Не удалось экспортировать CSV");
      }
    } finally {
      setExporting(false);
    }
  }

  // Copy phone helper
  function copyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Клиентская база</h1>
          <p className="mt-1 text-xs text-muted">
            История визитов, LTV, заметки и повторная запись в 1 клик
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting || clientsList.length === 0}
            className="btn btn-secondary h-9 gap-1.5 px-3 text-xs"
            title="Экспорт в Excel / CSV"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Экспорт в CSV
          </button>
          <button
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            className="btn btn-primary h-9 gap-1.5 px-3 text-xs"
          >
            <UserPlus size={14} />
            Новый клиент
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted">
            <Users size={16} />
            <span className="text-xs font-medium">Всего клиентов</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{stats.totalClients}</p>
          <p className="mt-1 text-[11px] text-muted">В базе салона</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600">
            <Sparkles size={16} />
            <span className="text-xs font-medium">VIP / Постоянные</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{stats.vipClients}</p>
          <p className="mt-1 text-[11px] text-muted">3+ визита или крупный чек</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Общий LTV</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {formatMoney(stats.totalRevenue, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted">Выручка со всех визитов</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600">
            <Zap size={16} />
            <span className="text-xs font-medium">Средний чек на клиента</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-ink">
            {formatMoney(stats.avgLtv, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted">Средний доход на 1 гостя</p>
        </div>
      </div>

      {/* Search, Filter Tabs and Sorter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, номеру, услуге..."
            className="h-9 w-full rounded-xl border border-line bg-paper pr-3 pl-8 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Segment Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: "all", label: "Все" },
              { id: "vip", label: "VIP" },
              { id: "regular", label: "Постоянные" },
              { id: "new", label: "Новые" },
              { id: "sleeping", label: "Спящие" },
            ] as const
          ).map((tab) => {
            const count =
              tab.id === "all"
                ? clientsList.length
                : clientsList.filter((c) => c.segment === tab.id).length;
            const active = segmentFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSegmentFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-black/5 text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted whitespace-nowrap">Сортировка:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-8 rounded-lg border border-line bg-paper px-2 text-xs text-ink focus:border-brand focus:outline-none"
          >
            <option value="recent">Недавние визиты</option>
            <option value="spent">Сумма (LTV)</option>
            <option value="visits">Число визитов</option>
            <option value="name">По алфавиту</option>
          </select>
        </div>
      </div>

      {/* Clients List / Table */}
      {filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center">
          <User className="mx-auto size-10 text-muted/60" />
          <h3 className="mt-3 text-sm font-semibold text-ink">Клиенты не найдены</h3>
          <p className="mt-1 text-xs text-muted">
            {search ? "Попробуйте изменить поисковый запрос" : "База клиентов формируется автоматически при онлайн-записях"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
          <div className="divide-y divide-line">
            {filteredClients.map((client) => {
              const seg = SEGMENT_BADGES[client.segment];
              const isSelected = selectedPhone === client.phone;

              return (
                <div
                  key={client.phone}
                  className={`flex flex-col gap-3 p-4 transition-colors hover:bg-paper/50 sm:flex-row sm:items-center sm:justify-between ${
                    isSelected ? "bg-brand/5" : ""
                  }`}
                >
                  {/* Left: Avatar + Contact info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="relative">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/5 font-semibold text-ink text-sm">
                        {client.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-white ${
                          client.segment === "vip"
                            ? "bg-amber-500"
                            : client.segment === "regular"
                            ? "bg-emerald-500"
                            : client.segment === "sleeping"
                            ? "bg-zinc-400"
                            : "bg-sky-500"
                        }`}
                        title={seg.label}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleOpenDetail(client.phone)}
                          className="text-left font-semibold text-ink text-sm hover:text-brand hover:underline"
                        >
                          {client.name}
                        </button>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${seg.bg} ${seg.text} ${seg.border}`}
                        >
                          {seg.label}
                        </span>
                        {/* Consent badge */}
                        <span
                          className="flex items-center gap-0.5 text-[10px] text-emerald-600"
                          title="Согласие на обработку контактов и уведомления получено"
                        >
                          <ShieldCheck size={11} />
                          <span>Согласие</span>
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone size={12} />
                          <a href={`tel:${client.phone}`} className="hover:text-ink">
                            {client.phone}
                          </a>
                          <button
                            onClick={() => copyPhone(client.phone)}
                            className="ml-0.5 text-muted hover:text-ink"
                            title="Скопировать номер"
                          >
                            {copiedPhone === client.phone ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </span>

                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} />
                            <span>{client.email}</span>
                          </span>
                        )}

                        {client.favoriteServiceName && (
                          <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">
                            Часто: {client.favoriteServiceName}
                          </span>
                        )}
                      </div>

                      {client.notes && (
                        <p className="mt-1.5 line-clamp-1 text-[11px] text-muted italic">
                          💬 {client.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Stats (Visits, Total spent, Last visit) */}
                  <div className="flex items-center gap-6 text-left sm:text-right">
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {client.completedVisits}{" "}
                        <span className="text-[11px] font-normal text-muted">
                          {client.completedVisits === 1
                            ? "визит"
                            : client.completedVisits < 5
                            ? "визита"
                            : "визитов"}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted">
                        {client.cancelledVisits > 0 && `${client.cancelledVisits} отмен`}
                        {client.noShowVisits > 0 && `, ${client.noShowVisits} неявок`}
                        {client.cancelledVisits === 0 && client.noShowVisits === 0 && "100% явка"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-emerald-700">
                        {formatMoney(client.totalSpent, currency)}
                      </p>
                      <p className="text-[10px] text-muted">LTV сумма</p>
                    </div>

                    <div className="hidden sm:block">
                      <p className="text-xs text-ink">
                        {client.lastVisitAt ? client.lastVisitAt.slice(0, 10) : "Нет визитов"}
                      </p>
                      <p className="text-[10px] text-muted">Последний визит</p>
                    </div>
                  </div>

                  {/* Right Actions: Quick Repeat + Detail button */}
                  <div className="flex items-center gap-2 pt-2 sm:pt-0">
                    <button
                      onClick={() => handleOpenRepeatBooking(client)}
                      className="btn btn-secondary h-8 gap-1 px-2.5 text-[11px] font-medium text-brand hover:border-brand/40"
                      title="Записать повторно в 1 клик"
                    >
                      <Zap size={12} />
                      Повторить
                    </button>
                    <button
                      onClick={() => handleOpenDetail(client.phone)}
                      className="btn btn-ghost h-8 px-2 text-muted hover:text-ink"
                      title="Детальная карточка и история"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL */}
      {selectedPhone && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="relative flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-xl bg-ink text-white font-semibold text-sm">
                  {clientDetail?.name.slice(0, 1).toUpperCase() ?? "К"}
                </div>
                <div>
                  <h2 className="font-bold text-ink text-sm sm:text-base">
                    {clientDetail?.name ?? "Загрузка..."}
                  </h2>
                  <p className="text-xs text-muted font-mono">{selectedPhone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPhone(null)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {loadingDetail ? (
                <div className="grid place-items-center py-20">
                  <Loader2 size={24} className="animate-spin text-brand" />
                  <p className="mt-2 text-xs text-muted">Загружаем историю клиента...</p>
                </div>
              ) : clientDetail ? (
                <>
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-line bg-paper p-2.5">
                      <p className="text-[10px] text-muted">Визиты</p>
                      <p className="mt-0.5 font-bold text-sm text-ink">
                        {clientDetail.completedVisits}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line bg-paper p-2.5">
                      <p className="text-[10px] text-muted">Общий чек (LTV)</p>
                      <p className="mt-0.5 font-bold text-xs text-emerald-700">
                        {formatMoney(clientDetail.totalSpent, currency)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-line bg-paper p-2.5">
                      <p className="text-[10px] text-muted">Средний чек</p>
                      <p className="mt-0.5 font-bold text-xs text-ink">
                        {formatMoney(clientDetail.avgBill, currency)}
                      </p>
                    </div>
                  </div>

                  {/* Consent & Contact Details */}
                  <div className="rounded-xl border border-line bg-paper/60 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted">
                      <span>Согласие на уведомления</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-600">
                        <ShieldCheck size={14} /> Получено
                      </span>
                    </div>
                    {clientDetail.email && (
                      <div className="flex items-center justify-between text-muted">
                        <span>Email</span>
                        <span className="text-ink">{clientDetail.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted">
                      <span>Клиент с нами</span>
                      <span className="text-ink">{clientDetail.createdAt.slice(0, 10)}</span>
                    </div>
                    {clientDetail.favoriteServiceName && (
                      <div className="flex items-center justify-between text-muted">
                        <span>Любимая услуга</span>
                        <span className="font-medium text-ink">
                          {clientDetail.favoriteServiceName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes Section with Quick Edit */}
                  <div className="rounded-xl border border-line bg-surface p-3.5">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-brand" />
                        Заметки о клиенте
                      </span>
                      {!editingNotes && (
                        <button
                          onClick={() => setEditingNotes(true)}
                          className="flex items-center gap-1 text-[11px] text-brand hover:underline"
                        >
                          <Edit3 size={11} />
                          Изменить
                        </button>
                      )}
                    </div>

                    {editingNotes ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="Предпочтения, аллергия, кофе, формула окрашивания..."
                          className="h-20 w-full rounded-lg border border-line p-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setNotesText(clientDetail.notes ?? "");
                              setEditingNotes(false);
                            }}
                            className="btn btn-ghost h-7 text-xs"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="btn btn-primary h-7 text-xs"
                          >
                            {savingNotes ? <Loader2 size={12} className="animate-spin" /> : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        {clientDetail.notes || "Заметок пока нет. Нажмите «Изменить», чтобы добавить важные детали."}
                      </p>
                    )}
                  </div>

                  {/* Repeat Booking Button inside Drawer */}
                  <button
                    onClick={() => handleOpenRepeatBooking(clientDetail)}
                    className="btn btn-primary w-full h-10 gap-2 text-xs font-semibold"
                  >
                    <Zap size={14} />
                    Повторная запись в 1 клик
                  </button>

                  {/* Booking History Timeline */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                      <History size={13} />
                      История визитов ({clientDetail.bookings.length})
                    </h3>

                    {clientDetail.bookings.length === 0 ? (
                      <p className="text-xs text-muted">Записей пока нет</p>
                    ) : (
                      <div className="space-y-2">
                        {clientDetail.bookings.map((b) => {
                          const st = STATUS_LABELS[b.status] ?? STATUS_LABELS.CONFIRMED;
                          return (
                            <div
                              key={b.id}
                              className="rounded-xl border border-line bg-paper/50 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink">{b.serviceName}</span>
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}
                                >
                                  {st.label}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-muted text-[11px]">
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} />
                                  {b.startAt.slice(0, 10)} {b.startAt.slice(11, 16)}
                                </span>
                                <span className="font-medium text-ink">
                                  {formatMoney(b.price, currency)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-muted">
                                <span>Мастер: {b.staffName}</span>
                                <span>{b.source === "MANUAL" ? "Вручную" : "Онлайн"}</span>
                              </div>

                              {b.cancellationReason && (
                                <p className="text-[10px] text-rose-600 bg-rose-50 rounded p-1">
                                  Причина отмены: {b.cancellationReason}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* QUICK REPEAT BOOKING MODAL */}
      {repeatModalOpen && repeatClient && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Zap size={14} />
                </span>
                <h3 className="font-bold text-ink text-sm">
                  Повторная запись: {repeatClient.name}
                </h3>
              </div>
              <button
                onClick={() => setRepeatModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRepeatSubmit} className="mt-4 space-y-3.5 text-xs">
              {repeatError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
                  {repeatError}
                </div>
              )}

              <div>
                <label className="font-semibold text-ink">Услуга</label>
                <select
                  value={repeatServiceId}
                  onChange={(e) => setRepeatServiceId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs text-ink focus:border-brand focus:outline-none"
                  required
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMin} мин, {formatMoney(s.price, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink">Мастер</label>
                <select
                  value={repeatStaffId}
                  onChange={(e) => setRepeatStaffId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs text-ink focus:border-brand focus:outline-none"
                  required
                >
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.title ? `(${st.title})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-ink">Дата</label>
                  <input
                    type="date"
                    value={repeatDate}
                    onChange={(e) => setRepeatDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink">Время</label>
                  <input
                    type="time"
                    value={repeatTime}
                    onChange={(e) => setRepeatTime(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepeatModalOpen(false)}
                  className="btn btn-ghost h-9 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={repeatPending}
                  className="btn btn-primary h-9 gap-1.5 px-4 text-xs font-semibold"
                >
                  {repeatPending ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
                  Записать клиента
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CLIENT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand">
                  <UserPlus size={14} />
                </span>
                <h3 className="font-bold text-ink text-sm">Новый клиент</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreatePending(true);
                setCreateError(null);
                const fd = new FormData(e.currentTarget);
                try {
                  const res = await saveClientAction(fd);
                  if (res.ok) {
                    setCreateModalOpen(false);
                    router.refresh();
                  } else {
                    setCreateError(res.error || "Не удалось сохранить");
                  }
                } finally {
                  setCreatePending(false);
                }
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
                  {createError}
                </div>
              )}

              <div>
                <label className="font-semibold text-ink">Имя клиента *</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Имя Фамилия"
                  className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs text-ink focus:border-brand focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Номер телефона *</label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs text-ink focus:border-brand focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Email (необязательно)</label>
                <input
                  name="email"
                  type="email"
                  placeholder="client@mail.uz"
                  className="mt-1 h-9 w-full rounded-xl border border-line bg-paper px-3 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Заметки / Пожелания</label>
                <textarea
                  name="notes"
                  placeholder="Предпочтения, аллергии, особенности..."
                  className="mt-1 h-18 w-full rounded-xl border border-line bg-paper p-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-paper/60 p-2.5 text-[11px] text-muted flex items-start gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Клиент даёт согласие на хранение контактных данных и получение уведомлений о записях.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-ghost h-9 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createPending}
                  className="btn btn-primary h-9 gap-1.5 px-4 text-xs font-semibold"
                >
                  {createPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Сохранить клиента
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
