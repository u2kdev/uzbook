"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { bookings, businesses, clients, services, staff } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { createBooking } from "@/server/booking/service";

export type ClientSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  telegramId: string | null;
  notes: string | null;
  createdAt: string;
  totalBookings: number;
  completedVisits: number;
  cancelledVisits: number;
  noShowVisits: number;
  totalSpent: number;
  avgBill: number;
  lastVisitAt: string | null;
  nextBookingAt: string | null;
  favoriteServiceName: string | null;
  favoriteServiceId: string | null;
  favoriteStaffName: string | null;
  favoriteStaffId: string | null;
  segment: "vip" | "regular" | "new" | "sleeping";
};

export type ClientBookingRecord = {
  id: string;
  startAt: string;
  endAt: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  price: number;
  status: string;
  cancellationReason: string | null;
  source: string;
  note: string | null;
};

export type ClientDetailedInfo = ClientSummary & {
  bookings: ClientBookingRecord[];
};

export async function getClientsAction(): Promise<{
  clients: ClientSummary[];
  stats: {
    totalClients: number;
    vipClients: number;
    totalRevenue: number;
    avgLtv: number;
  };
  currency: string;
}> {
  const session = await requireUser();
  if (session.role !== "OWNER") {
    return {
      clients: [],
      stats: { totalClients: 0, vipClients: 0, totalRevenue: 0, avgLtv: 0 },
      currency: "UZS",
    };
  }

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id, currency: businesses.currency })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) {
    return {
      clients: [],
      stats: { totalClients: 0, vipClients: 0, totalRevenue: 0, avgLtv: 0 },
      currency: "UZS",
    };
  }

  // 1. Fetch clients table records
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.businessId, business.id))
    .orderBy(desc(clients.createdAt));

  // 2. Fetch all bookings for this business with service and staff names
  const bookingRows = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      clientName: bookings.clientName,
      clientPhone: bookings.clientPhone,
      clientEmail: bookings.clientEmail,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      status: bookings.status,
      price: bookings.price,
      serviceId: bookings.serviceId,
      serviceName: services.name,
      staffId: bookings.staffId,
      staffName: staff.name,
      cancellationReason: bookings.cancelReason,
      source: bookings.source,
      note: bookings.note,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(staff, eq(bookings.staffId, staff.id))
    .where(eq(bookings.businessId, business.id))
    .orderBy(desc(bookings.startAt));

  // Build a map of phone -> bookings
  const bookingsByPhone = new Map<string, typeof bookingRows>();
  for (const b of bookingRows) {
    const list = bookingsByPhone.get(b.clientPhone) ?? [];
    list.push(b);
    bookingsByPhone.set(b.clientPhone, list);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Map to hold aggregated client summaries
  const clientMap = new Map<string, ClientSummary>();

  for (const c of clientRows) {
    const clientBookings = bookingsByPhone.get(c.phone) ?? [];
    const completed = clientBookings.filter(
      (b) => b.status === "COMPLETED" || (b.status === "CONFIRMED" && new Date(b.startAt) < now),
    );
    const cancelled = clientBookings.filter((b) => b.status === "CANCELLED");
    const noShow = clientBookings.filter((b) => b.status === "NO_SHOW");

    const totalSpent = completed.reduce((sum, b) => sum + b.price, 0);
    const avgBill = completed.length > 0 ? Math.round(totalSpent / completed.length) : 0;

    // Find last visit
    const lastVisit = completed.length > 0 ? completed[0].startAt.toISOString() : null;

    // Find next upcoming booking
    const upcoming = clientBookings
      .filter(
        (b) =>
          (b.status === "CONFIRMED" || b.status === "PENDING") &&
          new Date(b.startAt) >= now,
      )
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const nextBookingAt = upcoming.length > 0 ? upcoming[0].startAt.toISOString() : null;

    // Favorite service & staff (most frequent)
    const serviceCounts = new Map<string, { count: number; name: string }>();
    const staffCounts = new Map<string, { count: number; name: string }>();
    for (const b of completed) {
      if (b.serviceId) {
        const curr = serviceCounts.get(b.serviceId) ?? { count: 0, name: b.serviceName ?? "" };
        curr.count += 1;
        serviceCounts.set(b.serviceId, curr);
      }
      if (b.staffId) {
        const curr = staffCounts.get(b.staffId) ?? { count: 0, name: b.staffName ?? "" };
        curr.count += 1;
        staffCounts.set(b.staffId, curr);
      }
    }

    let favoriteServiceId: string | null = null;
    let favoriteServiceName: string | null = null;
    let maxSvcCount = 0;
    for (const [sId, data] of serviceCounts.entries()) {
      if (data.count > maxSvcCount) {
        maxSvcCount = data.count;
        favoriteServiceId = sId;
        favoriteServiceName = data.name;
      }
    }

    let favoriteStaffId: string | null = null;
    let favoriteStaffName: string | null = null;
    let maxStaffCount = 0;
    for (const [stId, data] of staffCounts.entries()) {
      if (data.count > maxStaffCount) {
        maxStaffCount = data.count;
        favoriteStaffId = stId;
        favoriteStaffName = data.name;
      }
    }

    // Determine segment
    let segment: "vip" | "regular" | "new" | "sleeping" = "new";
    if (completed.length >= 3 || totalSpent >= 500_000) {
      segment = "vip";
    } else if (completed.length >= 2) {
      segment = "regular";
    } else if (completed.length === 0 && clientBookings.length === 0) {
      segment = "new";
    } else if (completed.length > 0) {
      const lastDate = new Date(completed[0].startAt);
      if (lastDate < thirtyDaysAgo) {
        segment = "sleeping";
      } else {
        segment = "new";
      }
    }

    clientMap.set(c.phone, {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      telegramId: c.telegramId,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      totalBookings: clientBookings.length,
      completedVisits: completed.length,
      cancelledVisits: cancelled.length,
      noShowVisits: noShow.length,
      totalSpent,
      avgBill,
      lastVisitAt: lastVisit,
      nextBookingAt,
      favoriteServiceName,
      favoriteServiceId,
      favoriteStaffName,
      favoriteStaffId,
      segment,
    });
  }

  // Also include clients from bookings who might not be in clients table yet
  for (const [phone, list] of bookingsByPhone.entries()) {
    if (!clientMap.has(phone)) {
      const first = list[0];
      const completed = list.filter(
        (b) => b.status === "COMPLETED" || (b.status === "CONFIRMED" && new Date(b.startAt) < now),
      );
      const totalSpent = completed.reduce((sum, b) => sum + b.price, 0);

      clientMap.set(phone, {
        id: `phone-${phone}`,
        name: first.clientName,
        phone,
        email: first.clientEmail,
        telegramId: null,
        notes: null,
        createdAt: first.startAt.toISOString(),
        totalBookings: list.length,
        completedVisits: completed.length,
        cancelledVisits: list.filter((b) => b.status === "CANCELLED").length,
        noShowVisits: list.filter((b) => b.status === "NO_SHOW").length,
        totalSpent,
        avgBill: completed.length > 0 ? Math.round(totalSpent / completed.length) : 0,
        lastVisitAt: completed.length > 0 ? completed[0].startAt.toISOString() : null,
        nextBookingAt: null,
        favoriteServiceName: first.serviceName,
        favoriteServiceId: first.serviceId,
        favoriteStaffName: first.staffName,
        favoriteStaffId: first.staffId,
        segment: completed.length >= 2 ? "regular" : "new",
      });
    }
  }

  const clientsList = [...clientMap.values()].sort((a, b) => {
    // Sort by recent visit or creation
    const dateA = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  const totalRevenue = clientsList.reduce((sum, c) => sum + c.totalSpent, 0);
  const vipClients = clientsList.filter((c) => c.segment === "vip").length;
  const avgLtv = clientsList.length > 0 ? Math.round(totalRevenue / clientsList.length) : 0;

  return {
    clients: clientsList,
    stats: {
      totalClients: clientsList.length,
      vipClients,
      totalRevenue,
      avgLtv,
    },
    currency: business.currency,
  };
}

export async function getClientDetailedInfoAction(phone: string): Promise<ClientDetailedInfo | null> {
  const session = await requireUser();
  if (session.role !== "OWNER") return null;

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business || !phone) return null;

  const [clientRecord] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, business.id), eq(clients.phone, phone)))
    .limit(1);

  const bookingRows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      status: bookings.status,
      price: bookings.price,
      serviceId: bookings.serviceId,
      serviceName: services.name,
      staffId: bookings.staffId,
      staffName: staff.name,
      cancellationReason: bookings.cancelReason,
      source: bookings.source,
      note: bookings.note,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(staff, eq(bookings.staffId, staff.id))
    .where(and(eq(bookings.businessId, business.id), eq(bookings.clientPhone, phone)))
    .orderBy(desc(bookings.startAt));

  const now = new Date();
  const completed = bookingRows.filter(
    (b) => b.status === "COMPLETED" || (b.status === "CONFIRMED" && new Date(b.startAt) < now),
  );
  const totalSpent = completed.reduce((sum, b) => sum + b.price, 0);
  const avgBill = completed.length > 0 ? Math.round(totalSpent / completed.length) : 0;

  const mappedBookings: ClientBookingRecord[] = bookingRows.map((b) => ({
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    serviceId: b.serviceId ?? "",
    serviceName: b.serviceName ?? "Услуга",
    staffId: b.staffId ?? "",
    staffName: b.staffName ?? "Мастер",
    price: b.price,
    status: b.status,
    cancellationReason: b.cancellationReason,
    source: b.source,
    note: b.note,
  }));

  const firstBooking = bookingRows[bookingRows.length - 1];
  const clientName = clientRecord?.name ?? (bookingRows[0]?.id ? "Клиент" : "Неизвестный");

  return {
    id: clientRecord?.id ?? `phone-${phone}`,
    name: clientName,
    phone,
    email: clientRecord?.email ?? null,
    telegramId: clientRecord?.telegramId ?? null,
    notes: clientRecord?.notes ?? null,
    createdAt: (clientRecord?.createdAt ?? firstBooking?.startAt ?? now).toISOString(),
    totalBookings: bookingRows.length,
    completedVisits: completed.length,
    cancelledVisits: bookingRows.filter((b) => b.status === "CANCELLED").length,
    noShowVisits: bookingRows.filter((b) => b.status === "NO_SHOW").length,
    totalSpent,
    avgBill,
    lastVisitAt: completed[0]?.startAt ? completed[0].startAt.toISOString() : null,
    nextBookingAt: null,
    favoriteServiceName: completed[0]?.serviceName ?? null,
    favoriteServiceId: completed[0]?.serviceId ?? null,
    favoriteStaffName: completed[0]?.staffName ?? null,
    favoriteStaffId: completed[0]?.staffId ?? null,
    segment: completed.length >= 3 ? "vip" : completed.length >= 2 ? "regular" : "new",
    bookings: mappedBookings,
  };
}

export async function updateClientNotesAction(phone: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) return { ok: false, error: "Бизнес не найден" };

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.businessId, business.id), eq(clients.phone, phone)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(clients)
      .set({ notes: notes.trim() || null })
      .where(eq(clients.id, existing[0].id));
  } else {
    // If client wasn't in clients table yet, create row with notes
    await db.insert(clients).values({
      businessId: business.id,
      name: "Клиент",
      phone,
      notes: notes.trim() || null,
    });
  }

  revalidatePath("/dashboard/clients");
  return { ok: true };
}

export async function saveClientAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireUser();
  if (session.role !== "OWNER") return { ok: false, error: "Нет доступа" };

  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) return { ok: false, error: "Бизнес не найден" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (name.length < 2) return { ok: false, error: "Укажите имя клиента" };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Укажите корректный номер телефона" };

  await db
    .insert(clients)
    .values({
      businessId: business.id,
      name,
      phone,
      email,
      notes,
    })
    .onConflictDoUpdate({
      target: [clients.businessId, clients.phone],
      set: {
        name,
        email,
        notes,
      },
    });

  revalidatePath("/dashboard/clients");
  return { ok: true };
}

export async function exportClientsCsvAction(): Promise<{ ok: boolean; csv?: string; filename?: string; error?: string }> {
  const { clients: list, currency } = await getClientsAction();
  if (list.length === 0) {
    return { ok: false, error: "Список клиентов пуст" };
  }

  // Generate CSV with UTF-8 BOM so Excel opens it with proper encoding
  const BOM = "\uFEFF";
  const header = [
    "Имя",
    "Телефон",
    "Email",
    "Сегмент",
    "Всего визитов",
    "Отмен",
    "Неявок",
    `Потрачено (${currency})`,
    `Средний чек (${currency})`,
    "Последний визит",
    "Любимая услуга",
    "Мастер",
    "Заметки",
  ].map((col) => `"${col}"`).join(",");

  const rows = list.map((c) => {
    const segmentLabel =
      c.segment === "vip"
        ? "VIP"
        : c.segment === "regular"
        ? "Постоянный"
        : c.segment === "sleeping"
        ? "Спящий"
        : "Новый";

    return [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${(c.email ?? "").replace(/"/g, '""')}"`,
      `"${segmentLabel}"`,
      c.completedVisits,
      c.cancelledVisits,
      c.noShowVisits,
      c.totalSpent,
      c.avgBill,
      `"${c.lastVisitAt ? c.lastVisitAt.slice(0, 10) : "-"}"`,
      `"${(c.favoriteServiceName ?? "-").replace(/"/g, '""')}"`,
      `"${(c.favoriteStaffName ?? "-").replace(/"/g, '""')}"`,
      `"${(c.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csv = BOM + header + "\r\n" + rows.join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `clients-${dateStr}.csv`;

  return { ok: true, csv, filename };
}
