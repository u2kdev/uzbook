import { Building2 } from "lucide-react";
import { requireAdmin } from "@/server/auth/session";
import { getAdminBusinesses } from "@/server/business/admin";
import { BusinessTable } from "@/components/admin/business-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бизнесы" };

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const rows = await getAdminBusinesses();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Клиенты платформы
          </p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
            Бизнесы
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {rows.length} всего ·{" "}
            {rows.filter((row) => row.business.status === "ACTIVE").length} активны ·{" "}
            {rows.filter((row) => row.pending).length} ждут тариф
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-muted">
          <Building2 size={13} strokeWidth={1.6} /> {rows.length} аккаунтов
        </span>
      </div>

      <BusinessTable
        canManage={session.role === "ADMIN"}
        initialQuery={params.q ?? ""}
        rows={rows.map(({ business, ownerName, ownerEmail, ownerTelegramId, pending }) => ({
          id: business.id,
          name: business.name,
          slug: business.slug,
          status: business.status,
          plan: business.plan,
          trialEndsAt: business.trialEndsAt?.toISOString() ?? null,
          createdAt: business.createdAt.toISOString(),
          ownerName,
          ownerEmail,
          telegramLinked: Boolean(ownerTelegramId),
          pendingPlan: pending?.plan ?? null,
        }))}
      />
    </div>
  );
}
