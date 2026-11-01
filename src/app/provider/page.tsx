import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProvider } from "@/server/auth/session";
import { getProviderDashboardData } from "@/server/business/admin";
import { ProviderDashboard } from "@/components/provider/provider-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Кабинет провайдера" };

export default async function ProviderPage() {
  const session = await requireProvider();
  const data = await getProviderDashboardData(session.id);

  if (!data) {
    redirect("/login");
  }

  return (
    <ProviderDashboard
      provider={{
        id: data.provider.id,
        name: data.provider.name,
        email: data.provider.email,
        username: data.provider.username ?? null,
        phone: data.provider.phone ?? null,
        role: session.role,
        commissionPercent: data.provider.commissionPercent ?? 60,
        payoutCard: data.provider.payoutCard ?? null,
      }}
      clients={data.clients.map((c) => ({
        businessId: c.business.id,
        businessName: c.business.name,
        businessSlug: c.business.slug,
        category: c.business.category,
        city: c.business.city,
        status: c.business.status,
        plan: c.business.plan,
        trialEndsAt: c.business.trialEndsAt?.toISOString() ?? null,
        customStaffLimit: c.business.customStaffLimit ?? null,
        customClientLimit: c.business.customClientLimit ?? null,
        customPriceUzs: c.business.customPriceUzs ?? null,
        ownerName: c.ownerName,
        ownerEmail: c.ownerEmail,
        ownerPhone: c.ownerPhone,
        staffCount: c.staffCount,
        clientsCount: c.clientsCount,
        subscriptionStatus: c.latestSubscription?.status ?? null,
        subscriptionAmount: c.latestSubscription?.amount ?? null,
        providerPayoutAmount: c.latestSubscription?.providerPayoutAmount ?? null,
        createdAt: c.business.createdAt.toISOString(),
      }))}
      stats={data.stats}
    />
  );
}
