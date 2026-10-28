import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { services, staff } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { todayInZone } from "@/server/booking/time";
import { getClientsAction } from "@/server/actions/clients";
import { ClientsManager } from "@/components/dashboard/clients-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клиенты" };

export default async function ClientsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();
  const [{ clients: initialClients, stats, currency }, serviceRows, staffRows] =
    await Promise.all([
      getClientsAction(),
      db
        .select()
        .from(services)
        .where(and(eq(services.businessId, business.id), eq(services.isActive, true)))
        .orderBy(asc(services.sortOrder), asc(services.name)),
      db
        .select()
        .from(staff)
        .where(and(eq(staff.businessId, business.id), eq(staff.isActive, true)))
        .orderBy(asc(staff.sortOrder), asc(staff.name)),
    ]);

  return (
    <ClientsManager
      initialClients={initialClients}
      stats={stats}
      currency={currency}
      timezone={business.timezone}
      today={todayInZone(business.timezone)}
      services={serviceRows.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        price: s.price,
      }))}
      staff={staffRows.map((st) => ({
        id: st.id,
        name: st.name,
        color: st.color,
        title: st.title,
      }))}
    />
  );
}
