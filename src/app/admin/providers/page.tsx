import { requireAdmin } from "@/server/auth/session";
import { getAdminProviders, getProviderApplications } from "@/server/business/admin";
import { ProviderManager } from "@/components/admin/provider-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Провайдеры и спец-заявки" };

export default async function AdminProvidersPage() {
  const session = await requireAdmin();
  const [applications, providers] = await Promise.all([
    getProviderApplications(),
    getAdminProviders(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Партнёрская сеть · Providers
        </p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          Провайдеры и заявки
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Оформление провайдеров (выдача никнейма, пароля и персонального процента выплат на карту)
          и контроль подключённых ими клиентов.
        </p>
      </div>

      <ProviderManager
        canManage={session.role === "ADMIN"}
        applications={applications.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          phone: a.phone,
          email: a.email,
          telegram: a.telegram,
          city: a.city,
          payoutCard: a.payoutCard,
          experienceNote: a.experienceNote,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        }))}
        providers={providers.map((p) => ({
          id: p.provider.id,
          name: p.provider.name,
          email: p.provider.email,
          username: p.provider.username ?? null,
          phone: p.provider.phone ?? null,
          commissionPercent: p.provider.commissionPercent ?? 60,
          payoutCard: p.provider.payoutCard ?? null,
          createdAt: p.provider.createdAt.toISOString(),
          connectedBusinesses: p.connectedBusinesses.map((b) => ({
            ...b,
            trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
          })),
          totalPlatformRevenue: p.totalPlatformRevenue,
          totalProviderPayout: p.totalProviderPayout,
          pendingPayout: p.pendingPayout,
        }))}
      />
    </div>
  );
}
